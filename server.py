#!/usr/bin/env python3
"""
事项跟进管理系统 - 后端服务
使用 Python 内置模块，不依赖任何外部库
数据存储在 matters_data.json 文件中

启动方式: python3 server.py
访问地址: http://localhost:8000
"""

import json
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import time
import string
import random

# ====== 配置 ======
PORT = 8000
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'matters_data.json')
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

# ====== 数据初始化 ======
def get_default_data():
    return {
        "matters": [],
        "settings": {
            "pushTime": "09:00",
            "pushEnabled": True
        }
    }

def load_data():
    if not os.path.exists(DATA_FILE):
        save_data(get_default_data())
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"数据加载失败: {e}")
        return get_default_data()

def save_data(data):
    try:
        with open(DATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"数据保存失败: {e}")
        return False

def gen_id():
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=12))

# ====== 请求处理器 ======
class MatterHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        # 自定义日志，更友好
        print(f"[{self.log_date_time_string()}] {self.client_address[0]} - {format % args}")

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(body))
        self._cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def send_file(self, path):
        ext = os.path.splitext(path)[1].lower()
        content_types = {
            '.html': 'text/html; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.js': 'application/javascript; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.ico': 'image/x-icon',
        }
        content_type = content_types.get(ext, 'application/octet-stream')
        try:
            with open(path, 'rb') as f:
                body = f.read()
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', len(body))
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            self.send_response(404)
            self.end_headers()

    def _cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        if length:
            return json.loads(self.rfile.read(length).decode('utf-8'))
        return {}

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # ====== API 路由 ======
        if path == '/api/matters':
            data = load_data()
            self.send_json(200, {'success': True, 'data': data['matters']})
            return

        if path == '/api/settings':
            data = load_data()
            self.send_json(200, {'success': True, 'data': data['settings']})
            return

        if path == '/api/stats':
            data = load_data()
            matters = data['matters']
            stats = {
                'total': len(matters),
                'pending': sum(1 for m in matters if m.get('status') == 'pending'),
                'in_progress': sum(1 for m in matters if m.get('status') == 'in_progress'),
                'completed': sum(1 for m in matters if m.get('status') == 'completed'),
                'blocked': sum(1 for m in matters if m.get('status') == 'blocked'),
            }
            self.send_json(200, {'success': True, 'data': stats})
            return

        # ====== 静态文件 ======
        if path == '/' or path == '':
            path = '/index.html'
        file_path = os.path.join(STATIC_DIR, path.lstrip('/'))
        if os.path.isfile(file_path):
            self.send_file(file_path)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # 添加事项
        if path == '/api/matters':
            body = self.read_body()
            data = load_data()
            now = time.strftime('%Y-%m-%dT%H:%M:%S')
            created_at = body.get('createdAt', now)
            matter = {
                'id': gen_id(),
                'content': body.get('content', ''),
                'status': 'pending',
                'createdAt': created_at,
                'updatedAt': now,
                'replies': [],
                'attachments': body.get('attachments', [])
            }
            data['matters'].append(matter)
            save_data(data)
            self.send_json(201, {'success': True, 'data': matter})
            return

        # 添加回复：POST /api/matters/:id/replies
        parts = path.strip('/').split('/')
        if len(parts) == 4 and parts[0] == 'api' and parts[1] == 'matters' and parts[3] == 'replies':
            matter_id = parts[2]
            body = self.read_body()
            data = load_data()
            matter = next((m for m in data['matters'] if m['id'] == matter_id), None)
            if not matter:
                self.send_json(404, {'success': False, 'error': '事项不存在'})
                return
            now = time.strftime('%Y-%m-%dT%H:%M:%S')
            reply = {
                'id': gen_id(),
                'content': body.get('content', ''),
                'author': body.get('author', '匿名'),
                'createdAt': now,
                'attachments': body.get('attachments', [])
            }
            matter.setdefault('replies', []).append(reply)
            matter['updatedAt'] = now
            save_data(data)
            self.send_json(201, {'success': True, 'data': reply})
            return
        
        # 更新回复：PUT /api/matters/:id/replies/:replyId
        if len(parts) == 5 and parts[0] == 'api' and parts[1] == 'matters' and parts[3] == 'replies':
            matter_id = parts[2]
            reply_id = parts[4]
            body = self.read_body()
            data = load_data()
            matter = next((m for m in data['matters'] if m['id'] == matter_id), None)
            if not matter:
                self.send_json(404, {'success': False, 'error': '事项不存在'})
                return
            reply = next((r for r in matter.get('replies', []) if r['id'] == reply_id), None)
            if not reply:
                self.send_json(404, {'success': False, 'error': '回复不存在'})
                return
            # 更新字段
            if 'content' in body:
                reply['content'] = body['content']
            if 'author' in body:
                reply['author'] = body['author']
            if 'attachments' in body:
                reply['attachments'] = body['attachments']
            matter['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
            save_data(data)
            self.send_json(200, {'success': True, 'data': reply})
            return

        self.send_json(404, {'success': False, 'error': '路由不存在'})

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        parts = path.strip('/').split('/')

        # 更新事项：PUT /api/matters/:id
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'matters':
            matter_id = parts[2]
            body = self.read_body()
            data = load_data()
            matter = next((m for m in data['matters'] if m['id'] == matter_id), None)
            if not matter:
                self.send_json(404, {'success': False, 'error': '事项不存在'})
                return
            # 允许更新的字段
            for field in ['content', 'status', 'createdAt']:
                if field in body:
                    matter[field] = body[field]
            if 'attachments' in body:
                matter['attachments'] = body['attachments']
            matter['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
            save_data(data)
            self.send_json(200, {'success': True, 'data': matter})
            return

        # 更新设置：PUT /api/settings
        if path == '/api/settings':
            body = self.read_body()
            data = load_data()
            data['settings'].update(body)
            save_data(data)
            self.send_json(200, {'success': True, 'data': data['settings']})
            return

        self.send_json(404, {'success': False, 'error': '路由不存在'})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        parts = path.strip('/').split('/')

        # 删除事项：DELETE /api/matters/:id
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'matters':
            matter_id = parts[2]
            data = load_data()
            original_len = len(data['matters'])
            data['matters'] = [m for m in data['matters'] if m['id'] != matter_id]
            if len(data['matters']) == original_len:
                self.send_json(404, {'success': False, 'error': '事项不存在'})
                return
            save_data(data)
            self.send_json(200, {'success': True, 'message': '删除成功'})
            return
        
        # 删除回复：DELETE /api/matters/:id/replies/:replyId
        if len(parts) == 5 and parts[0] == 'api' and parts[1] == 'matters' and parts[3] == 'replies':
            matter_id = parts[2]
            reply_id = parts[4]
            data = load_data()
            matter = next((m for m in data['matters'] if m['id'] == matter_id), None)
            if not matter:
                self.send_json(404, {'success': False, 'error': '事项不存在'})
                return
            original_len = len(matter.get('replies', []))
            matter['replies'] = [r for r in matter.get('replies', []) if r['id'] != reply_id]
            if len(matter['replies']) == original_len:
                self.send_json(404, {'success': False, 'error': '回复不存在'})
                return
            matter['updatedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
            save_data(data)
            self.send_json(200, {'success': True, 'message': '删除成功'})
            return

        self.send_json(404, {'success': False, 'error': '路由不存在'})


# ====== 主程序 ======
def main():
    # 初始化数据文件
    if not os.path.exists(DATA_FILE):
        save_data(get_default_data())
        print(f"✅ 数据文件已初始化: {DATA_FILE}")

    server = HTTPServer(('0.0.0.0', PORT), MatterHandler)

    # 获取本机 IP
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = '127.0.0.1'

    print("=" * 50)
    print("  📋 事项跟进管理系统 - 服务已启动")
    print("=" * 50)
    print(f"  本机访问: http://localhost:{PORT}")
    print(f"  局域网访问: http://{local_ip}:{PORT}")
    print(f"  数据存储: {DATA_FILE}")
    print("  按 Ctrl+C 停止服务")
    print("=" * 50)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()


if __name__ == '__main__':
    main()
