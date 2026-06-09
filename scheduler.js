/**
 * 定时推送模块（服务端驱动版）
 * 不依赖任何外部库
 */

const Scheduler = {
    intervalId: null,
    lastPushDate: null,

    init() {
        // 防重复初始化：先清除旧定时器
        if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
        this.lastPushDate = localStorage.getItem('matters_last_push_date') || null;
        this.startScheduler();
    },

    startScheduler() {
        this.checkAndPush();
        this.intervalId = setInterval(() => this.checkAndPush(), 60000);
    },

    stopScheduler() {
        if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    },

    async checkAndPush() {
        const settings = await DataStore.getSettings();
        if (!settings.pushEnabled) return;

        const now = new Date();
        const [h, m] = (settings.pushTime || '09:00').split(':').map(Number);
        const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
        const todayStr = now.toDateString();

        if (Math.abs(now - target) < 60000 && this.lastPushDate !== todayStr) {
            this.push(todayStr);
        }
    },

    async push(todayStr) {
        const pending = await DataStore.getPendingMatters();
        const stats = await DataStore.getStats();
        this.lastPushDate = todayStr || new Date().toDateString();
        localStorage.setItem('matters_last_push_date', this.lastPushDate);

        const content = this.buildContent(pending, stats);
        this.showNotification(content);

        window.dispatchEvent(new CustomEvent('matters-push', { detail: { matters: pending, stats, content } }));
        return content;
    },

    buildContent(matters, stats) {
        // 按跟进天数分类
        const overdue = [];      // 超过7天
        const warning = [];       // 超过3天
        const normal = [];        // 正常跟进
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        matters.forEach(m => {
            const created = new Date(m.createdAt);
            created.setHours(0, 0, 0, 0);
            const days = Math.floor((today - created) / (1000 * 60 * 60 * 24));
            
            const item = { ...m, days };
            if (days > 7) {
                overdue.push(item);
            } else if (days > 3) {
                warning.push(item);
            } else {
                normal.push(item);
            }
        });
        
        let c = `📋 今日待跟进事项提醒\n\n`;
        c += `共 ${stats.total} 项，其中 ${stats.pending} 项待处理\n\n`;
        
        if (matters.length === 0) { 
            c += `✅ 太棒了！暂无待跟进事项`; 
            return c; 
        }
        
        // 超过7天的事项
        if (overdue.length > 0) {
            c += `⚠️ 【超过一周】(${overdue.length}项)\n`;
            overdue.forEach((m, i) => {
                c += `  ${i + 1}. ${m.content}\n`;
            });
            c += `\n`;
        }
        
        // 超过3天的事项
        if (warning.length > 0) {
            c += `⏰ 【超过3天】(${warning.length}项)\n`;
            warning.forEach((m, i) => {
                c += `  ${i + 1}. ${m.content}\n`;
            });
            c += `\n`;
        }
        
        // 正常跟进的事项
        if (normal.length > 0) {
            c += `📝 【正常跟进】(${normal.length}项)\n`;
            normal.forEach((m, i) => {
                c += `  ${i + 1}. ${m.content}\n`;
            });
            c += `\n`;
        }
        
        return c;
    },

    showNotification(content) {
        const old = document.querySelector('.push-notification');
        if (old) old.remove();

        const el = document.createElement('div');
        el.className = 'push-notification';
        el.innerHTML = `
            <div class="push-header">
                <span class="push-icon">🔔</span>
                <span class="push-title">事项提醒</span>
                <button class="push-close">&times;</button>
            </div>
            <div class="push-content"><pre>${content}</pre></div>
            <div class="push-footer">
                <button class="push-action" data-action="view-all">查看全部</button>
            </div>`;

        if (!document.getElementById('push-styles')) {
            const style = document.createElement('style');
            style.id = 'push-styles';
            style.textContent = `
                .push-notification{position:fixed;top:20px;right:20px;width:360px;background:#fff;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.15);z-index:10000;animation:slideIn .3s ease-out;font-family:inherit}
                @keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
                .push-header{display:flex;align-items:center;padding:16px;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:12px 12px 0 0;color:#fff}
                .push-icon{font-size:20px;margin-right:8px}.push-title{flex:1;font-weight:600}
                .push-close{background:none;border:none;color:#fff;font-size:24px;cursor:pointer;padding:0;line-height:1}
                .push-content{padding:16px;max-height:280px;overflow-y:auto}.push-content pre{margin:0;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#333;font-family:inherit}
                .push-footer{padding:12px 16px;border-top:1px solid #eee;display:flex;justify-content:flex-end}
                .push-action{padding:8px 16px;border:none;border-radius:6px;background:#667eea;color:#fff;cursor:pointer;font-size:14px}
                .push-action:hover{background:#5568d3}`;
            document.head.appendChild(style);
        }

        el.querySelector('.push-close').addEventListener('click', () => el.remove());
        el.querySelector('[data-action="view-all"]').addEventListener('click', () => {
            el.remove();
            App.switchView('list');
        });

        document.body.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 8000);
    },

    async manualPush() {
        await this.push(null);
    }
};

window.Scheduler = Scheduler;
