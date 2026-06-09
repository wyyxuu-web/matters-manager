#!/usr/bin/env python3
"""
事项跟进管理系统 - 后端服务（Supabase 版）
数据存储在 Supabase PostgreSQL，不再依赖本地 JSON 文件

启动方式: python3 server.py
环境变量: SUPABASE_URL, SUPABASE_ANON_KEY, PORT（可选，默认 8000）
"""

import json
import os
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
import time
import string
import random

from supabase import create_client, Client

# ====== 配置 ======
PORT = int(os.environ.get('PORT', 8000))
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://piwebuchomdywncfgyuq.supabase.co')
SUPABASE_ANON_KEY = os.environ.get('SUPABASE_ANON_KEY', 'sb_publishable_MjblorVpn2ydqABUg2uDNg_Y6eCIiML')
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))

# ====== Supabase 客户端 ======
supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)


def gen_id():
    chars = string.ascii_letters + string.digits
    return ''.join(random.choices(chars, k=12))


def hash_password(password):
    """SHA-256 密码哈希"""
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


# ====== 请求处理器 ======
class MatterHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
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

    # ====== 辅助函数 ======

    def _get_matter_with_details(self, matter_row):
        """将数据库行转为完整的事项对象，包含 replies 和 attachments"""
        matter = dict(matter_row)
        matter['replies'] = []
        matter['attachments'] = []

        try:
            # 获取回复
            replies_resp = supabase.table('replies').select('*').eq('matter_id', matter['id']).order('created_at').execute()
            for reply_row in replies_resp.data:
                reply = dict(reply_row)
                # 转换日期字段为前端兼容的驼峰命名
                if 'created_at' in reply:
                    reply['createdAt'] = self._to_iso(reply.pop('created_at'))
                if 'updated_at' in reply:
                    reply['updatedAt'] = self._to_iso(reply.pop('updated_at'))
                # 获取回复的附件
                att_resp = supabase.table('attachments').select('*').eq('reply_id', reply['id']).execute()
                reply['attachments'] = []
                for att in att_resp.data:
                    reply['attachments'].append({
                        'name': att['name'],
                        'type': att['type'],
                        'url': att['data'],
                        'data': att['data']
                    })
                matter['replies'].append(reply)

            # 获取事项本身的附件
            att_resp = supabase.table('attachments').select('*').eq('matter_id', matter['id']).is_('reply_id', 'null').execute()
            for att in att_resp.data:
                matter['attachments'].append({
                    'name': att['name'],
                    'type': att['type'],
                    'url': att['data'],
                    'data': att['data']
                })
        except Exception as e:
            print(f"获取详情失败: {e}")

        # 转换 created_by 为驼峰
        if 'created_by' in matter:
            matter['createdBy'] = matter.pop('created_by')
        # 转换日期格式为前端兼容的 ISO 字符串
        for date_field in ['createdAt', 'created_at', 'createdat']:
            if date_field in matter:
                matter['createdAt'] = self._to_iso(matter.pop(date_field))
                break
        for date_field in ['updatedAt', 'updated_at', 'updatedat']:
            if date_field in matter:
                matter['updatedAt'] = self._to_iso(matter.pop(date_field))
                break

        return matter

    def _to_iso(self, val):
        """将数据库时间转为 ISO 字符串"""
        if val is None:
            return time.strftime('%Y-%m-%dT%H:%M:%S')
        if isinstance(val, str):
            return val
        try:
            return val.isoformat()
        except:
            return str(val)

    def _save_attachments(self, attachments, matter_id=None, reply_id=None):
        """保存附件到数据库"""
        for att in (attachments or []):
            att_id = gen_id()
            supabase.table('attachments').insert({
                'id': att_id,
                'matter_id': matter_id,
                'reply_id': reply_id,
                'name': att.get('name', ''),
                'type': att.get('type', 'file'),
                'data': att.get('data', att.get('url', ''))
            }).execute()

    # ====== GET 请求 ======

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # ====== API 路由 ======
        if path == '/api/matters':
            try:
                resp = supabase.table('matters').select('*').order('created_at', desc=True).execute()
                matters = [self._get_matter_with_details(row) for row in resp.data]
                self.send_json(200, {'success': True, 'data': matters})
            except Exception as e:
                print(f"获取事项失败: {e}")
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        if path == '/api/settings':
            try:
                resp = supabase.table('settings').select('*').execute()
                settings = {}
                for row in resp.data:
                    key = row['key']
                    val = row['value']
                    if key == 'pushEnabled':
                        settings[key] = val.lower() == 'true'
                    else:
                        settings[key] = val
                self.send_json(200, {'success': True, 'data': settings})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        if path == '/api/stats':
            try:
                resp = supabase.table('matters').select('status').execute()
                stats = {
                    'total': len(resp.data),
                    'pending': sum(1 for r in resp.data if r.get('status') == 'pending'),
                    'in_progress': sum(1 for r in resp.data if r.get('status') == 'in_progress'),
                    'completed': sum(1 for r in resp.data if r.get('status') == 'completed'),
                    'blocked': sum(1 for r in resp.data if r.get('status') == 'blocked'),
                }
                self.send_json(200, {'success': True, 'data': stats})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
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

    # ====== POST 请求 ======

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        # ====== 认证相关路由 ======

        # 生成邀请码（仅管理员）
        if path == '/api/auth/generate-invite':
            body = self.read_body()
            username = (body.get('username') or '').strip()
            role = (body.get('role') or '').strip()

            # 校验管理员权限
            if role != 'admin':
                self.send_json(403, {'success': False, 'error': '仅管理员可生成邀请码'})
                return

            try:
                code_id = gen_id()
                code_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
                code = f"MM-{code_suffix}"

                supabase.table('invite_codes').insert({
                    'id': code_id,
                    'code': code,
                    'created_by': username
                }).execute()

                self.send_json(201, {'success': True, 'data': {'code': code}})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # 注册
        if path == '/api/auth/register':
            body = self.read_body()
            username = (body.get('username') or '').strip()
            password = (body.get('password') or '').strip()
            invite_code = (body.get('inviteCode') or '').strip()

            if not username or not password:
                self.send_json(400, {'success': False, 'error': '用户名和密码不能为空'})
                return
            if len(password) < 4:
                self.send_json(400, {'success': False, 'error': '密码长度至少4位'})
                return
            if not invite_code:
                self.send_json(400, {'success': False, 'error': '请输入邀请码'})
                return

            try:
                # 校验邀请码
                code_resp = supabase.table('invite_codes').select('*').eq('code', invite_code).execute()
                if not code_resp.data:
                    self.send_json(400, {'success': False, 'error': '邀请码无效'})
                    return
                code_row = code_resp.data[0]
                if code_row.get('used_by'):
                    self.send_json(400, {'success': False, 'error': '该邀请码已被使用'})
                    return

                # 检查用户名是否已存在
                existing = supabase.table('users').select('id').eq('username', username).execute()
                if existing.data:
                    self.send_json(400, {'success': False, 'error': '用户名已存在'})
                    return

                # 创建用户
                user_id = gen_id()
                supabase.table('users').insert({
                    'id': user_id,
                    'username': username,
                    'password_hash': hash_password(password),
                    'role': 'user'
                }).execute()

                # 标记邀请码已使用
                now = time.strftime('%Y-%m-%dT%H:%M:%S')
                supabase.table('invite_codes').update({
                    'used_by': username,
                    'used_at': now
                }).eq('code', invite_code).execute()

                self.send_json(201, {'success': True, 'data': {'id': user_id, 'username': username}})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # 登录
        if path == '/api/auth/login':
            body = self.read_body()
            username = (body.get('username') or '').strip()
            password = (body.get('password') or '').strip()

            if not username or not password:
                self.send_json(400, {'success': False, 'error': '用户名和密码不能为空'})
                return

            try:
                resp = supabase.table('users').select('*').eq('username', username).execute()
                if not resp.data:
                    self.send_json(401, {'success': False, 'error': '用户名或密码错误'})
                    return

                user = resp.data[0]
                if user['password_hash'] != hash_password(password):
                    self.send_json(401, {'success': False, 'error': '用户名或密码错误'})
                    return

                # 生成简单 token（username + timestamp hash）
                token_raw = f"{username}:{time.time()}:{gen_id()}"
                token = hashlib.sha256(token_raw.encode()).hexdigest()

                # 返回用户信息和 token（不返回密码哈希）
                self.send_json(200, {
                    'success': True,
                    'data': {
                        'token': token,
                        'user': {
                            'id': user['id'],
                            'username': user['username'],
                            'role': user['role']
                        }
                    }
                })
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # 修改密码
        if path == '/api/auth/change-password':
            body = self.read_body()
            username = (body.get('username') or '').strip()
            old_password = (body.get('oldPassword') or '').strip()
            new_password = (body.get('newPassword') or '').strip()

            if not username or not old_password or not new_password:
                self.send_json(400, {'success': False, 'error': '请填写完整信息'})
                return
            if len(new_password) < 4:
                self.send_json(400, {'success': False, 'error': '新密码长度至少4位'})
                return

            try:
                resp = supabase.table('users').select('*').eq('username', username).execute()
                if not resp.data:
                    self.send_json(404, {'success': False, 'error': '用户不存在'})
                    return

                user = resp.data[0]
                if user['password_hash'] != hash_password(old_password):
                    self.send_json(401, {'success': False, 'error': '原密码错误'})
                    return

                supabase.table('users').update({
                    'password_hash': hash_password(new_password)
                }).eq('username', username).execute()

                self.send_json(200, {'success': True, 'message': '密码修改成功'})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # 删除用户（管理员功能）
        if path == '/api/auth/delete-user':
            body = self.read_body()
            user_id = (body.get('userId') or '').strip()
            if not user_id:
                self.send_json(400, {'success': False, 'error': '缺少用户ID'})
                return
            try:
                supabase.table('users').delete().eq('id', user_id).execute()
                self.send_json(200, {'success': True, 'message': '用户已删除'})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # ====== 事项相关路由 ======
        if path == '/api/matters':
            body = self.read_body()
            now = time.strftime('%Y-%m-%dT%H:%M:%S')
            created_at = body.get('createdAt', now)
            matter_id = gen_id()

            try:
                created_by = body.get('createdBy', '')
                supabase.table('matters').insert({
                    'id': matter_id,
                    'content': body.get('content', ''),
                    'status': 'pending',
                    'created_at': created_at,
                    'updated_at': now,
                    'created_by': created_by
                }).execute()

                # 保存附件
                self._save_attachments(body.get('attachments', []), matter_id=matter_id)

                # 返回完整对象
                matter = {
                    'id': matter_id,
                    'content': body.get('content', ''),
                    'status': 'pending',
                    'createdAt': created_at,
                    'updatedAt': now,
                    'replies': [],
                    'attachments': body.get('attachments', [])
                }
                self.send_json(201, {'success': True, 'data': matter})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # 添加回复 / 更新回复
        parts = path.strip('/').split('/')
        if len(parts) >= 4 and parts[0] == 'api' and parts[1] == 'matters' and parts[3] == 'replies':
            matter_id = parts[2]

            # 更新回复：PUT 逻辑（在 POST 中处理，因为前端可能发 POST）
            if len(parts) == 5:
                reply_id = parts[4]
                body = self.read_body()
                try:
                    updates = {}
                    if 'content' in body:
                        updates['content'] = body['content']
                    if 'author' in body:
                        updates['author'] = body['author']
                    supabase.table('replies').update(updates).eq('id', reply_id).execute()

                    # 更新附件（替换）
                    if 'attachments' in body:
                        supabase.table('attachments').delete().eq('reply_id', reply_id).execute()
                        self._save_attachments(body['attachments'], matter_id=matter_id, reply_id=reply_id)

                    supabase.table('matters').update({'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')}).eq('id', matter_id).execute()

                    resp = supabase.table('replies').select('*').eq('id', reply_id).execute()
                    if resp.data:
                        reply = dict(resp.data[0])
                        reply['createdAt'] = self._to_iso(reply.pop('created_at', ''))
                        self.send_json(200, {'success': True, 'data': reply})
                    else:
                        self.send_json(404, {'success': False, 'error': '回复不存在'})
                except Exception as e:
                    self.send_json(500, {'success': False, 'error': str(e)})
                return

            # 添加回复
            if len(parts) == 4:
                body = self.read_body()
                now = time.strftime('%Y-%m-%dT%H:%M:%S')
                reply_id = gen_id()

                try:
                    supabase.table('replies').insert({
                        'id': reply_id,
                        'matter_id': matter_id,
                        'content': body.get('content', ''),
                        'author': body.get('author', '匿名'),
                        'created_at': now
                    }).execute()

                    # 保存附件
                    self._save_attachments(body.get('attachments', []), matter_id=matter_id, reply_id=reply_id)

                    supabase.table('matters').update({'updated_at': now}).eq('id', matter_id).execute()

                    reply = {
                        'id': reply_id,
                        'content': body.get('content', ''),
                        'author': body.get('author', '匿名'),
                        'createdAt': now,
                        'attachments': body.get('attachments', [])
                    }
                    self.send_json(201, {'success': True, 'data': reply})
                except Exception as e:
                    self.send_json(500, {'success': False, 'error': str(e)})
                return

        self.send_json(404, {'success': False, 'error': '路由不存在'})

    # ====== PUT 请求 ======

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path
        parts = path.strip('/').split('/')

        # 更新事项
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'matters':
            matter_id = parts[2]
            body = self.read_body()
            try:
                updates = {'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')}
                for field in ['content', 'status', 'created_at']:
                    if field in body:
                        updates[field] = body[field]

                supabase.table('matters').update(updates).eq('id', matter_id).execute()

                # 更新附件
                if 'attachments' in body:
                    supabase.table('attachments').delete().eq('matter_id', matter_id).is_('reply_id', 'null').execute()
                    self._save_attachments(body['attachments'], matter_id=matter_id)

                self.send_json(200, {'success': True, 'data': {'id': matter_id, **updates}})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # 更新设置
        if path == '/api/settings':
            body = self.read_body()
            try:
                for key, val in body.items():
                    supabase.table('settings').upsert({
                        'key': key,
                        'value': str(val).lower() if isinstance(val, bool) else str(val)
                    }).execute()

                self.send_json(200, {'success': True, 'data': body})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        self.send_json(404, {'success': False, 'error': '路由不存在'})

    # ====== DELETE 请求 ======

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path
        parts = path.strip('/').split('/')

        # 删除事项（级联删除回复和附件）
        if len(parts) == 3 and parts[0] == 'api' and parts[1] == 'matters':
            matter_id = parts[2]
            try:
                supabase.table('matters').delete().eq('id', matter_id).execute()
                self.send_json(200, {'success': True, 'message': '删除成功'})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        # 删除回复
        if len(parts) == 5 and parts[0] == 'api' and parts[1] == 'matters' and parts[3] == 'replies':
            matter_id = parts[2]
            reply_id = parts[4]
            try:
                supabase.table('replies').delete().eq('id', reply_id).execute()
                supabase.table('matters').update({'updated_at': time.strftime('%Y-%m-%dT%H:%M:%S')}).eq('id', matter_id).execute()
                self.send_json(200, {'success': True, 'message': '删除成功'})
            except Exception as e:
                self.send_json(500, {'success': False, 'error': str(e)})
            return

        self.send_json(404, {'success': False, 'error': '路由不存在'})


# ====== 主程序 ======
def main():

    server = HTTPServer(('0.0.0.0', PORT), MatterHandler)

    print("=" * 50)
    print("  📋 事项跟进管理系统 - 服务已启动（Supabase 版）")
    print("=" * 50)
    print(f"  端口: {PORT}")
    print(f"  数据库: Supabase PostgreSQL")
    print("  按 Ctrl+C 停止服务")
    print("=" * 50)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")
        server.server_close()


if __name__ == '__main__':
    main()
