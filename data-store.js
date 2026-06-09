/**
 * 数据存储模块 - 调用后端 API
 * 不依赖任何外部库，数据存储于服务端 JSON 文件
 */

const DataStore = {
    BASE_URL: '',  // 相对路径，自动适配 localhost 和局域网 IP

    // 通用请求方法
    async request(method, path, body) {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) opts.body = JSON.stringify(body);
        try {
            const res = await fetch(this.BASE_URL + path, opts);
            return await res.json();
        } catch (e) {
            console.error(`请求失败 [${method} ${path}]:`, e);
            return { success: false, error: e.message };
        }
    },

    // 获取所有事项
    async getMatters() {
        const res = await this.request('GET', '/api/matters');
        return res.success ? res.data : [];
    },

    // 添加事项
    async addMatter(matter) {
        const res = await this.request('POST', '/api/matters', matter);
        return res.success ? res.data : null;
    },

    // 更新事项
    async updateMatter(id, updates) {
        const res = await this.request('PUT', `/api/matters/${id}`, updates);
        return res.success ? res.data : null;
    },

    // 删除事项
    async deleteMatter(id) {
        const res = await this.request('DELETE', `/api/matters/${id}`);
        return res.success;
    },

    // 更新状态
    async updateStatus(id, status) {
        return await this.updateMatter(id, { status });
    },

    // 添加回复
    async addReply(matterId, reply) {
        const res = await this.request('POST', `/api/matters/${matterId}/replies`, reply);
        return res.success ? res.data : null;
    },
    
    // 更新回复
    async updateReply(matterId, replyId, updates) {
        const res = await this.request('PUT', `/api/matters/${matterId}/replies/${replyId}`, updates);
        return res.success ? res.data : null;
    },
    
    // 删除回复
    async deleteReply(matterId, replyId) {
        const res = await this.request('DELETE', `/api/matters/${matterId}/replies/${replyId}`);
        return res.success;
    },

    // 获取统计
    async getStats() {
        const res = await this.request('GET', '/api/stats');
        return res.success ? res.data : { total: 0, pending: 0, in_progress: 0, completed: 0, blocked: 0 };
    },

    // 获取待推送事项（非完成）
    async getPendingMatters() {
        const matters = await this.getMatters();
        return matters.filter(m => m.status !== 'completed');
    },

    // 获取设置
    async getSettings() {
        const res = await this.request('GET', '/api/settings');
        return res.success ? res.data : { pushTime: '09:00', pushEnabled: true };
    },

    // 更新设置
    async updateSettings(settings) {
        const res = await this.request('PUT', '/api/settings', settings);
        return res.success ? res.data : null;
    },

    // ====== 认证相关 ======

    // 注册
    async register(username, password, inviteCode) {
        const res = await this.request('POST', '/api/auth/register', { username, password, inviteCode });
        return res;
    },

    // 登录
    async login(username, password) {
        const res = await this.request('POST', '/api/auth/login', { username, password });
        if (res.success) {
            localStorage.setItem('auth_token', res.data.token);
            localStorage.setItem('auth_user', JSON.stringify(res.data.user));
        }
        return res;
    },

    // 修改密码
    async changePassword(username, oldPassword, newPassword) {
        const res = await this.request('POST', '/api/auth/change-password', { username, oldPassword, newPassword });
        return res;
    },

    // 生成邀请码
    async generateInviteCode() {
        const res = await this.request('GET', '/api/auth/generate-invite');
        return res;
    },

    // 获取邀请码列表
    async getInviteCodes() {
        const res = await this.request('GET', '/api/auth/invite-codes');
        return res.success ? res.data : [];
    },

    // 获取当前登录用户
    getCurrentUser() {
        try {
            return JSON.parse(localStorage.getItem('auth_user'));
        } catch {
            return null;
        }
    },

    // 获取 token
    getToken() {
        return localStorage.getItem('auth_token');
    },

    // 登出
    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
    }
};

window.DataStore = DataStore;
