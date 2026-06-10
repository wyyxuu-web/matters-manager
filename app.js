/**
 * 事项管理主应用 - 异步版本
 * 不依赖任何外部库
 */

const App = {
    currentView: 'list',
    editingMatter: null,
    editingReplyId: null,  // 当前编辑的回复ID
    selectedMatter: null,
    pollInterval: null,
    dateFilter: { start: '', end: '' },  // 日期筛选
    currentStatusFilter: 'all',          // 当前状态筛选
    pendingFiles: {},      // 新上传附件的临时存储（用于支持删除）
    matterCache: [],       // 内存缓存，避免重复请求

    // 初始化
    async init() {
        // 认证事件始终绑定（无论是否登录都需要）
        this.bindAuthEvents();

        // 先检查登录状态
        if (!DataStore.getCurrentUser()) {
            this.showLogin();
            return;
        }
        // 已登录，显示主界面
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('main-app').style.display = 'block';
        await this.checkConnection();
        await this.render();
        Scheduler.init();
        this.bindEvents();
        this.startPolling();
    },

    // 渲染界面
    async render() {
        await Promise.all([
            this.renderStats(),
            this.renderMatterList()
        ]);
    },

    // 渲染统计
    async renderStats(statsData) {
        const stats = statsData || await DataStore.getStats();
        document.getElementById('stats-container').innerHTML = `
            <div class="stat-item" data-status="all" onclick="App.clickStatFilter('all')">
                <span class="stat-number">${stats.total}</span>
                <span class="stat-label">全部</span>
            </div>
            <div class="stat-item stat-pending" data-status="pending" onclick="App.clickStatFilter('pending')">
                <span class="stat-number">${stats.pending}</span>
                <span class="stat-label">待处理</span>
            </div>
            <div class="stat-item stat-progress" data-status="in_progress" onclick="App.clickStatFilter('in_progress')">
                <span class="stat-number">${stats.in_progress}</span>
                <span class="stat-label">进行中</span>
            </div>
            <div class="stat-item stat-blocked" data-status="blocked" onclick="App.clickStatFilter('blocked')">
                <span class="stat-number">${stats.blocked}</span>
                <span class="stat-label">遇问题</span>
            </div>
            <div class="stat-item stat-completed" data-status="completed" onclick="App.clickStatFilter('completed')">
                <span class="stat-number">${stats.completed}</span>
                <span class="stat-label">已完成</span>
            </div>
        `;
    },

    // 渲染事项列表
    async renderMatterList() {
        const allMatters = await DataStore.getMatters();
        this.matterCache = allMatters;  // 更新缓存
        let matters = allMatters;
        
        // 应用日期筛选
        if (this.dateFilter.start) {
            matters = matters.filter(m => new Date(m.createdAt) >= new Date(this.dateFilter.start));
        }
        if (this.dateFilter.end) {
            matters = matters.filter(m => new Date(m.createdAt) <= new Date(this.dateFilter.end + 'T23:59:59'));
        }
        
        const container = document.getElementById('matter-list');

        if (matters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📋</div>
                    <div class="empty-text">暂无事项</div>
                    <div class="empty-hint">点击上方「添加事项」开始</div>
                </div>`;
            return;
        }

        const sorted = [...matters].sort((a, b) => {
            const order = { blocked: 0, pending: 1, in_progress: 2, completed: 3 };
            if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // 保存/恢复滚动位置
        const scrollTop = container.scrollTop;
        container.innerHTML = sorted.map(m => this.renderMatterCard(m)).join('');
        this.bindCardEvents();
        if (scrollTop > 0) container.scrollTop = scrollTop;
    },

    // 检查是否有新回复（兼容轻量/完整格式）
    hasNewReply(matter) {
        const key = `matter_reply_count_${matter.id}`;
        const lastSeenCount = parseInt(localStorage.getItem(key) || '0', 10);
        const currentCount = (matter.replies || []).length || matter.replyCount || 0;
        return currentCount > lastSeenCount;
    },

    // 标记回复已读
    markRepliesRead(matterId) {
        const matters = DataStore._cachedMatters; // 从缓存获取当前数量
        // 重新从 DataStore 获取最新数据
        DataStore.getMatters().then(all => {
            const m = all.find(x => x.id === matterId);
            if (m) {
                localStorage.setItem(`matter_reply_count_${matterId}`, (m.replies || []).length);
            }
        });
    },

    // 渲染单个事项卡片
    renderMatterCard(matter) {
        const statusMap = {
            pending:     { text: '待处理', cls: 'status-pending' },
            in_progress: { text: '进行中', cls: 'status-progress' },
            completed:   { text: '已完成', cls: 'status-completed' },
            blocked:     { text: '遇问题', cls: 'status-blocked' }
        };
        const st = statusMap[matter.status] || statusMap.pending;
        
        // 计算已跟进天数（只比较日期部分，忽略时间）
        const createdDate = new Date(matter.createdAt);
        const today = new Date();
        // 重置时间为 00:00:00，确保只按日期差计算
        const createdDateOnly = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
        const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const daysSinceCreated = Math.floor((todayDateOnly - createdDateOnly) / (1000 * 60 * 60 * 24));
        
        // 根据天数显示跟进标签
        let followupTag = '';
        if (matter.status !== 'completed') {
            if (daysSinceCreated > 7) {
                followupTag = '<span class="followup-tag followup-urgent">⚠️ 超过一周</span>';
            } else if (daysSinceCreated > 3) {
                followupTag = '<span class="followup-tag followup-warning">⏰ 超过3天</span>';
            }
        }
        
        const createdDateStr = createdDate.toLocaleDateString('zh-CN');
        const hasAttachments = matter.attachments && matter.attachments.length > 0;
        const replyCount = (matter.replies || []).length;
        const hasNew = this.hasNewReply(matter);
        const newBadge = hasNew ? '<span class="new-reply-badge" title="有新回复">●</span>' : '';

        // 状态操作按钮
        let actionButtons = '';
        if (matter.status === 'completed') {
            actionButtons = `<button class="action-btn uncomplete-btn" data-action="uncomplete" data-id="${matter.id}" title="标记为未完成">❌ 未完成</button>`;
        } else {
            actionButtons = `<button class="action-btn complete-btn" data-action="complete" data-id="${matter.id}" title="标记为已完成">✅ 完成</button>`;
            if (matter.status !== 'blocked') {
                actionButtons += `<button class="action-btn blocked-btn" data-action="block" data-id="${matter.id}" title="标记为遇问题">🚧 遇问题</button>`;
            }
        }

        return `
        <div class="matter-card ${st.cls}" data-id="${matter.id}">
            <div class="matter-card-body" data-action="view-replies" data-id="${matter.id}" title="点击查看详情">
                <div class="matter-header">
                    <span class="matter-status ${st.cls}">${st.text}</span>
                    ${followupTag}
                    <div class="matter-header-right">
                        <span class="matter-meta-inline">📅 ${createdDateStr}（${daysSinceCreated}天）${hasAttachments ? ' 📎' : ''} ${matter.createdBy ? `<span style="color:#999;font-size:12px;">· ${matter.createdBy}</span>` : ''}</span>
                        <div class="matter-card-actions">
                            <button class="card-action-btn card-edit-btn" data-action="edit" data-id="${matter.id}" title="编辑">✏️ 编辑</button>
                            <button class="card-action-btn card-delete-btn" data-action="delete" data-id="${matter.id}" title="删除">🗑️ 删除</button>
                        </div>
                    </div>
                </div>
                <div class="matter-content">${matter.content}</div>
                ${hasAttachments ? this.renderAttachments(matter.attachments, 'card') : ''}
            </div>
            <div class="matter-footer">
                <span class="matter-replies" data-action="view-replies" data-id="${matter.id}">
                    💬 ${replyCount} 条回复 ${newBadge}
                </span>
                <div class="matter-actions">
                    ${actionButtons}
                </div>
            </div>
        </div>`;
    },
    
    // 渲染附件
    renderAttachments(attachments, scope) {
        if (!attachments || attachments.length === 0) return '';
        const items = attachments.map(att => `
            <div class="attachment-item ${att.type === 'image' ? 'is-image' : ''}">
                ${att.type === 'image' 
                    ? `<img src="${att.url}" alt="${att.name}" class="attachment-image" onclick="App.previewImage('${att.url}')">`
                    : `<a href="${att.url}" download="${att.name}" class="attachment-file">📄 ${att.name}</a>`
                }
            </div>
        `).join('');
        return `<div class="attachment-list">${items}</div>`;
    },
    
    // 预览图片
    previewImage(url) {
        const modal = document.createElement('div');
        modal.className = 'image-preview-modal';
        modal.innerHTML = `<img src="${url}" alt="预览"><button class="modal-close" onclick="this.parentElement.remove()">&times;</button>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    },

    // 绑定卡片事件
    bindCardEvents() {
        document.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const { action, id } = btn.dataset;
                if (action === 'edit')         await this.editMatter(id);
                else if (action === 'delete')  await this.deleteMatter(id);
                else if (action === 'complete') await this.markComplete(id);
                else if (action === 'uncomplete') await this.markUncomplete(id);
                else if (action === 'block')   await this.markBlocked(id);
                else if (action === 'view-replies') await this.showReplies(id);
            });
        });
    },

    // 绑定主事件
    bindEvents() {
        // 附件上传预览
        document.getElementById('matter-attachments').addEventListener('change', (e) => {
            this.renderAttachmentPreview(e.target.files, 'matter-attachments-preview');
        });
        
        // 回复附件上传预览
        document.getElementById('reply-attachments').addEventListener('change', (e) => {
            this.renderAttachmentPreview(e.target.files, 'reply-attachments-preview');
        });
        
        document.getElementById('add-btn').addEventListener('click', () => {
            // 强制清理编辑状态，确保是新建而非编辑
            this.editingMatter = null;
            this.resetForm();
            this.switchView('add');
        });
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        document.getElementById('save-btn').addEventListener('click', () => this.saveMatter());
        document.getElementById('cancel-btn').addEventListener('click', () => this.switchView('list'));
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
        document.getElementById('test-push-btn').addEventListener('click', () => Scheduler.manualPush());
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        document.getElementById('export-excel-btn').addEventListener('click', () => this.exportExcel());
        document.getElementById('export-zip-btn').addEventListener('click', () => this.exportZip());
        document.getElementById('clear-btn').addEventListener('click', async () => {
            if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
                const matters = await DataStore.getMatters();
                await Promise.all(matters.map(m => DataStore.deleteMatter(m.id)));
                await this.render();
            }
        });
        document.getElementById('reply-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.submitReply();
        });

        // 状态筛选按钮
        document.querySelectorAll('.quick-status-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.quick-status-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.stat-item').forEach(s => {
                    s.classList.toggle('active', s.dataset.status === btn.dataset.status);
                });
                this.filterByStatus(btn.dataset.status);
            });
        });
    },

    // 绑定认证事件
    bindAuthEvents() {
        // 登录
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // 注册
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // 导航链接
        const goRegister = document.getElementById('go-register-link');
        if (goRegister) {
            goRegister.addEventListener('click', (e) => {
                e.preventDefault();
                this.showRegister();
            });
        }
        const goLogin = document.getElementById('go-login-link');
        if (goLogin) {
            goLogin.addEventListener('click', (e) => {
                e.preventDefault();
                this.showLogin();
            });
        }

        // 修改密码
        const cpForm = document.getElementById('change-password-form');
        if (cpForm) {
            cpForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleChangePassword();
            });
        }

        // 生成邀请码
        const genInviteBtn = document.getElementById('generate-invite-btn');
        if (genInviteBtn) {
            genInviteBtn.addEventListener('click', () => this.handleGenerateInvite());
        }
    },

    // 显示登录页
    showLogin() {
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-view').classList.add('active');
        document.getElementById('register-view').classList.remove('active');
    },

    // 显示注册页
    showRegister() {
        document.getElementById('main-app').style.display = 'none';
        document.getElementById('login-view').classList.remove('active');
        document.getElementById('register-view').classList.add('active');
    },

    // 处理登录
    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const errorEl = document.getElementById('login-error');

        if (!username || !password) {
            this.showAuthError(errorEl, '请输入用户名和密码');
            return;
        }

        const btn = document.querySelector('#login-form .auth-btn');
        btn.disabled = true;
        btn.textContent = '登录中...';

        const res = await DataStore.login(username, password);
        if (res.success) {
            // 登录成功，显示主界面
            document.getElementById('login-view').classList.remove('active');
            document.getElementById('main-app').style.display = 'block';
            await this.checkConnection();
            await this.render();
            Scheduler.init();
            this.startPolling();
        } else {
            this.showAuthError(errorEl, res.error || '登录失败');
        }

        btn.disabled = false;
        btn.textContent = '登录';
    },

    // 处理注册
    async handleRegister() {
        const username = document.getElementById('reg-username').value.trim();
        const password = document.getElementById('reg-password').value.trim();
        const inviteCode = document.getElementById('reg-invite-code').value.trim();
        const errorEl = document.getElementById('register-error');
        const successEl = document.getElementById('register-success');

        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!username || !password || !inviteCode) {
            this.showAuthError(errorEl, '请填写所有字段');
            return;
        }
        if (password.length < 4) {
            this.showAuthError(errorEl, '密码长度至少4位');
            return;
        }

        const btn = document.querySelector('#register-form .auth-btn');
        btn.disabled = true;
        btn.textContent = '注册中...';

        const res = await DataStore.register(username, password, inviteCode);
        if (res.success) {
            successEl.textContent = '注册成功！请返回登录页面登录。';
            successEl.style.display = 'block';
            document.getElementById('register-form').reset();
        } else {
            this.showAuthError(errorEl, res.error || '注册失败');
        }

        btn.disabled = false;
        btn.textContent = '注册';
    },

    // 处理修改密码
    async handleChangePassword() {
        const user = DataStore.getCurrentUser();
        if (!user) return;

        const oldPassword = document.getElementById('cp-old-password').value.trim();
        const newPassword = document.getElementById('cp-new-password').value.trim();
        const errorEl = document.getElementById('cp-error');
        const successEl = document.getElementById('cp-success');

        errorEl.style.display = 'none';
        successEl.style.display = 'none';

        if (!oldPassword || !newPassword) {
            this.showAuthError(errorEl, '请填写原密码和新密码');
            return;
        }
        if (newPassword.length < 4) {
            this.showAuthError(errorEl, '新密码长度至少4位');
            return;
        }

        const btn = document.getElementById('change-password-btn');
        btn.disabled = true;
        btn.textContent = '修改中...';

        const res = await DataStore.changePassword(user.username, oldPassword, newPassword);
        if (res.success) {
            successEl.textContent = '密码修改成功';
            successEl.style.display = 'block';
            document.getElementById('change-password-form').reset();
            setTimeout(() => { successEl.style.display = 'none'; }, 3000);
        } else {
            this.showAuthError(errorEl, res.error || '修改失败');
        }

        btn.disabled = false;
        btn.textContent = '修改密码';
    },

    // 处理生成邀请码
    async handleGenerateInvite() {
        const btn = document.getElementById('generate-invite-btn');
        const resultEl = document.getElementById('invite-result');
        const user = DataStore.getCurrentUser();
        if (!user) return;

        btn.disabled = true;
        btn.textContent = '生成中...';

        const res = await DataStore.generateInviteCode(user.username, user.role);
        if (res.success) {
            resultEl.textContent = `新邀请码：${res.data.code}`;
            // 刷新邀请码列表
            await this.renderInviteCodes();
        } else {
            resultEl.textContent = res.error || '生成失败';
        }

        btn.disabled = false;
        btn.textContent = '生成邀请码';
    },

    // 渲染邀请码列表
    async renderInviteCodes() {
        const codes = await DataStore.getInviteCodes();
        const container = document.getElementById('invite-codes-list');

        if (codes.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">暂无邀请码</div>';
            return;
        }

        container.innerHTML = `
            <table class="invite-table">
                <thead>
                    <tr>
                        <th>邀请码</th>
                        <th>状态</th>
                        <th>使用者</th>
                        <th>使用时间</th>
                    </tr>
                </thead>
                <tbody>
                    ${codes.map(c => `
                        <tr>
                            <td><code>${c.code}</code></td>
                            <td><span class="invite-status ${c.used_by ? 'used' : 'available'}">${c.used_by ? '已使用' : '可用'}</span></td>
                            <td>${c.used_by || '-'}</td>
                            <td>${c.used_at ? new Date(c.used_at).toLocaleString('zh-CN') : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    // 渲染用户列表（管理员功能）
    async renderUsers() {
        const user = DataStore.getCurrentUser();
        const section = document.getElementById('user-management-section');
        if (!user || user.role !== 'admin') {
            if (section) section.style.display = 'none';
            return;
        }
        section.style.display = 'block';

        const users = await DataStore.getUsers();
        const container = document.getElementById('users-list');

        if (users.length === 0) {
            container.innerHTML = '<div style="color: var(--text-muted); font-size: 13px;">暂无用户</div>';
            return;
        }

        const currentUserId = user.id;
        container.innerHTML = `
            <table class="invite-table">
                <thead>
                    <tr>
                        <th>用户名</th>
                        <th>角色</th>
                        <th>注册时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>${u.username}</td>
                            <td><span class="role-badge role-${u.role}">${u.role === 'admin' ? '管理员' : '用户'}</span></td>
                            <td>${u.created_at ? new Date(u.created_at).toLocaleString('zh-CN') : '-'}</td>
                            <td>
                                ${u.id !== currentUserId
                                    ? `<button class="btn-outline btn-danger" style="padding:4px 12px; font-size:12px;" onclick="App.deleteUser('${u.id}', '${u.username}')">删除</button>`
                                    : '<span style="color:var(--text-muted);font-size:12px;">当前账号</span>'
                                }
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    // 删除用户
    async deleteUser(userId, username) {
        if (!confirm(`确定要删除用户「${username}」吗？此操作不可撤销。`)) return;

        const res = await DataStore.deleteUser(userId);
        if (res.success) {
            this.showToast(`用户「${username}」已删除`);
            this.renderUsers();
        } else {
            alert('删除失败：' + (res.error || '未知错误'));
        }
    },

    // 根据角色显示/隐藏管理员专属功能
    applyAdminVisibility() {
        const user = DataStore.getCurrentUser();
        const isAdmin = user && user.role === 'admin';
        const inviteSection = document.getElementById('invite-management-section');
        if (inviteSection) {
            inviteSection.style.display = isAdmin ? '' : 'none';
        }
        const userSection = document.getElementById('user-management-section');
        if (userSection) {
            userSection.style.display = isAdmin ? 'block' : 'none';
        }
    },

    // 显示认证错误
    showAuthError(el, msg) {
        el.textContent = msg;
        el.style.display = 'block';
    },

    // 退出登录
    logout() {
        DataStore.logout();
        this.stopPolling();
        this.showLogin();
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
    },

    // 切换视图
    async switchView(view) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`${view}-view`);
        if (target) target.classList.add('active');
        this.currentView = view;
        if (view === 'list') {
            this.renderStats();
            this.filterByStatus(this.currentStatusFilter);
        }
        else if (view === 'settings') {
            this.loadSettings();
            this.renderInviteCodes();
            this.renderUsers();
            this.applyAdminVisibility();
        }
    },

    // 编辑事项
    async editMatter(id) {
        const matters = await DataStore.getMatters();
        const matter = matters.find(m => m.id === id);
        if (matter) {
            this.editingMatter = matter;
            document.getElementById('matter-content').value = matter.content;
            document.getElementById('matter-created-date').value = matter.createdAt.split('T')[0];
            // 加载已有附件
            this.loadExistingAttachments(matter.attachments || []);
            document.getElementById('form-title').textContent = '编辑事项';
            this.switchView('add');
        }
    },
    
    // 加载已有附件到编辑表单
    loadExistingAttachments(attachments) {
        const container = document.getElementById('existing-attachments');
        if (!attachments || attachments.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = attachments.map((att, i) => `
            <div class="attachment-preview-item" data-index="${i}">
                ${att.type === 'image'
                    ? `<img src="${att.url}" alt="${att.name}">`
                    : `<span class="file-icon">📄</span><span class="file-name">${att.name}</span>`
                }
                <button type="button" class="remove-attachment" onclick="App.removeExistingAttachment(${i})">×</button>
                <input type="hidden" name="existing_attachment" value="${JSON.stringify(att).replace(/"/g, '&quot;')}">
            </div>
        `).join('');
    },
    
    // 移除已有附件
    removeExistingAttachment(index) {
        const container = document.getElementById('existing-attachments');
        const items = container.querySelectorAll('.attachment-preview-item');
        if (items[index]) {
            items[index].remove();
        }
    },

    // 保存事项
    async saveMatter() {
        const content = document.getElementById('matter-content').value.trim();
        const createdDate = document.getElementById('matter-created-date').value;
        if (!content) { alert('请输入事项内容'); return; }
        if (!createdDate) { alert('请选择创建日期'); return; }

        const btn = document.getElementById('save-btn');
        btn.disabled = true;
        btn.textContent = '保存中...';

        // 收集附件
        const attachments = [];
        
        // 已有附件
        document.querySelectorAll('input[name="existing_attachment"]').forEach(input => {
            try {
                attachments.push(JSON.parse(input.value.replace(/&quot;/g, '"')));
            } catch(e) {}
        });
        
        // 新上传的附件（从 pendingFiles 读取，支持删除后的最新列表）
        const newFiles = this.pendingFiles['matter-attachments-preview'] || [];
        if (newFiles.length > 0) {
            for (const file of newFiles) {
                const base64 = await this.fileToBase64(file);
                attachments.push({
                    name: file.name,
                    type: file.type.startsWith('image/') ? 'image' : 'file',
                    data: base64,
                    url: base64  // 同时保存 url 方便前端展示
                });
            }
        }

        const matterData = { content, attachments };

        if (this.editingMatter) {
            // 编辑时保留原创建日期，只更新内容
            matterData.createdAt = this.editingMatter.createdAt;
            await DataStore.updateMatter(this.editingMatter.id, matterData);
        } else {
            // 新建时设置创建日期，记录创建者
            matterData.createdAt = createdDate + 'T' + new Date().toTimeString().slice(0, 8);
            const user = DataStore.getCurrentUser();
            if (user) matterData.createdBy = user.username;
            await DataStore.addMatter(matterData);
        }

        btn.disabled = false;
        btn.textContent = '保存';
        this.resetForm();
        this.pendingFiles['matter-attachments-preview'] = [];
        // 清缓存，确保切回列表时拉取最新数据（含新增事项）
        this.matterCache = [];
        this._lastRenderHash = null;
        await this.switchView('list');
    },

    // 渲染附件预览（文件选择后立即显示，支持删除）
    renderAttachmentPreview(files, containerId) {
        let container = document.getElementById(containerId);
        if (!container) {
            const inputEl = containerId === 'matter-attachments-preview'
                ? document.getElementById('matter-attachments')
                : document.getElementById('reply-attachments');
            container = document.createElement('div');
            container.id = containerId;
            container.className = 'attachment-preview-container';
            // 插入到 file-upload-container 的父元素（form-group）中，紧跟在 file-upload-container 后面
            const formGroup = inputEl.closest('.form-group');
            if (formGroup) {
                formGroup.appendChild(container);
            } else {
                inputEl.parentElement.parentElement.appendChild(container);
            }
        }

        // 初始化该容器的文件列表
        if (!this.pendingFiles[containerId]) {
            this.pendingFiles[containerId] = [];
        }

        // 为每个新文件生成 objectURL 并追加
        const fileArray = Array.from(files);
        fileArray.forEach(file => {
            if (file.type && file.type.startsWith('image/')) {
                file._objectUrl = URL.createObjectURL(file);
            }
        });
        this.pendingFiles[containerId].push(...fileArray);

        this._renderPreviewList(containerId, container);
    },
    
    // 内部方法：根据 pendingFiles 渲染预览列表
    _renderPreviewList(containerId, container) {
        const fileList = this.pendingFiles[containerId];
        
        if (!fileList || fileList.length === 0) {
            container.innerHTML = '';
            // 同步清空 file input，以便重新选择同名文件
            const inputId = containerId === 'matter-attachments-preview' ? 'matter-attachments' : 'reply-attachments';
            const inputEl = document.getElementById(inputId);
            if (inputEl) inputEl.value = '';
            return;
        }
        
        const previews = fileList.map((file, idx) => {
            const isImage = file.type && file.type.startsWith('image/');
            const sizeStr = file.size > 1024 * 1024 
                ? (file.size / (1024 * 1024)).toFixed(1) + ' MB'
                : (file.size / 1024).toFixed(0) + ' KB';
            
            let mediaHtml;
            if (isImage && file._objectUrl) {
                mediaHtml = `<img src="${file._objectUrl}" alt="${file.name}" class="preview-image">`;
            } else {
                mediaHtml = `<div class="preview-file-icon">📄</div>`;
            }
            
            return `
                <div class="attachment-preview-item" data-preview-index="${idx}">
                    <button type="button" class="preview-remove-btn" onclick="App.removePreviewFile('${containerId}', ${idx})" title="删除">&times;</button>
                    ${mediaHtml}
                    <div class="preview-info">
                        <span class="preview-name">${file.name}</span>
                        <span class="preview-size">${sizeStr}</span>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = `
            <div class="preview-header">已选择 ${fileList.length} 个文件</div>
            <div class="preview-list">${previews}</div>
        `;
    },
    
    // 删除预览中的文件
    removePreviewFile(containerId, index) {
        if (this.pendingFiles[containerId]) {
            // 释放 objectURL 防止内存泄漏
            const file = this.pendingFiles[containerId][index];
            if (file && file._objectUrl) {
                URL.revokeObjectURL(file._objectUrl);
                file._objectUrl = null;
            }
            this.pendingFiles[containerId].splice(index, 1);
        }
        const container = document.getElementById(containerId);
        if (container) this._renderPreviewList(containerId, container);
    },
    
    // 文件转 Base64
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    // 删除事项
    async deleteMatter(id) {
        if (!confirm('⚠️ 确定要删除这个事项吗？\n\n此操作不可恢复！')) return;
        const btn = document.querySelector(`[data-action="delete"][data-id="${id}"]`);
        if (btn) {
            btn.textContent = '删除中...';
            btn.disabled = true;
        }
        await DataStore.deleteMatter(id);
        await this.render();
    },

    // 标记为已完成
    async markComplete(id) {
        await DataStore.updateStatus(id, 'completed');
        await this.render();
    },

    // 标记为未完成（已完成 → 进行中，保留回复）
    async markUncomplete(id) {
        await DataStore.updateStatus(id, 'in_progress');
        await this.render();
    },

    // 标记为遇问题
    async markBlocked(id) {
        await DataStore.updateStatus(id, 'blocked');
        await this.render();
    },

    // 显示回复
    async showReplies(id) {
        // 先切换视图
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById('replies-view').classList.add('active');
        this.currentView = 'replies';
        
        // 优先从缓存获取，同时异步刷新
        let matter = this.matterCache.find(m => m.id === id);
        if (matter) {
            this.selectedMatter = matter;
            localStorage.setItem(`matter_reply_count_${matter.id}`, (matter.replies || []).length);
            this.renderReplies(matter);
        }
        
        // 异步拉取最新数据，如有变化则刷新
        DataStore.getMatters().then(matters => {
            this.matterCache = matters;
            const fresh = matters.find(m => m.id === id);
            if (fresh && (!matter || fresh.updatedAt !== matter.updatedAt)) {
                this.selectedMatter = fresh;
                localStorage.setItem(`matter_reply_count_${fresh.id}`, (fresh.replies || []).length);
                this.renderReplies(fresh);
            }
        });

        // 设置回复作者输入框权限
        this.setupReplyAuthor();
    },

    // 设置回复作者输入框（普通用户锁定为用户名，管理员可编辑）
    setupReplyAuthor() {
        const user = DataStore.getCurrentUser();
        if (!user) return;
        const authorInput = document.getElementById('reply-author');
        if (!authorInput) return;
        if (user.role === 'admin') {
            authorInput.readOnly = false;
            authorInput.placeholder = '回复者姓名（可编辑）';
            if (!authorInput.value) authorInput.value = user.username;
        } else {
            authorInput.readOnly = true;
            authorInput.value = user.username;
            authorInput.style.background = '#f5f5f5';
            authorInput.title = '名字已锁定为你的用户名';
        }
    },

    // 渲染回复
    renderReplies(matter) {
        const container = document.getElementById('reply-list');
        const statusMap = {
            pending:     { text: '待处理', cls: 'status-pending' },
            in_progress: { text: '进行中', cls: 'status-progress' },
            completed:   { text: '已完成', cls: 'status-completed' },
            blocked:     { text: '遇问题', cls: 'status-blocked' }
        };
        const st = statusMap[matter.status] || statusMap.pending;
        
        const createdDate = new Date(matter.createdAt).toLocaleDateString('zh-CN');
        const matterAttachments = matter.attachments || [];

        // 状态操作按钮
        let replyStatusActions = '';
        if (matter.status === 'completed') {
            replyStatusActions = `<button class="btn-status-action uncomplete" onclick="App.replyMarkUncomplete('${matter.id}')" title="标记为未完成">❌ 未完成</button>`;
        } else {
            replyStatusActions = `<button class="btn-status-action complete" onclick="App.replyMarkComplete('${matter.id}')" title="标记为已完成">✅ 完成</button>`;
            if (matter.status !== 'blocked') {
                replyStatusActions += `<button class="btn-status-action blocked" onclick="App.replyMarkBlocked('${matter.id}')" title="标记为遇问题">🚧 遇问题</button>`;
            }
        }

        document.getElementById('reply-matter-info').innerHTML = `
            <div class="matter-brief">
                <span class="brief-content">${matter.content}</span>
                <span id="reply-status-badge" class="matter-status ${st.cls}">${st.text}</span>
                <span class="brief-meta">📅 ${createdDate}</span>
                ${matterAttachments.length > 0 ? `
                <div class="brief-attachments">
                    ${this.renderReplyAttachments(matter.attachments)}
                </div>` : ''}
                <div class="brief-status-actions">${replyStatusActions}</div>
            </div>`;

        const replies = matter.replies || [];

        if (replies.length === 0) {
            container.innerHTML = `<div class="empty-replies">暂无回复，收到推送后可在此回复</div>`;
            return;
        }
        container.innerHTML = replies.map((r, idx) => `
            <div class="reply-item" data-reply-id="${r.id}">
                <div class="reply-header">
                    <span class="reply-index">${idx + 1}</span>
                    <span class="reply-author">${r.author || '匿名'}</span>
                    <span class="reply-time">${new Date(r.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div class="reply-content">${r.content}</div>
                ${r.attachments && r.attachments.length > 0 ? this.renderReplyAttachments(r.attachments) : ''}
                <div class="reply-footer-actions">
                    <button class="reply-edit-btn" onclick="App.startEditReply('${r.id}')" title="编辑">✏️ 编辑</button>
                    <button class="reply-delete-btn" onclick="App.deleteReply('${r.id}')" title="删除">🗑️ 删除</button>
                </div>
            </div>`).join('');
        
        this.bindReplyActions();
    },
    
    // 渲染回复附件
    renderReplyAttachments(attachments) {
        const items = attachments.map(att => `
            <div class="reply-attachment-item ${att.type === 'image' ? 'is-image' : ''}">
                ${att.type === 'image' 
                    ? `<img src="${att.url}" alt="${att.name}" class="reply-attachment-image" onclick="App.previewImage('${att.url}')">`
                    : `<a href="${att.url}" download="${att.name}" class="reply-attachment-file">📄 ${att.name}</a>`
                }
            </div>
        `).join('');
        return `<div class="reply-attachment-list">${items}</div>`;
    },
    
    // 绑定回复操作
    bindReplyActions() {
        document.querySelectorAll('[data-action="edit-reply"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startEditReply(btn.dataset.id);
            });
        });
        document.querySelectorAll('[data-action="delete-reply"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteReply(btn.dataset.id);
            });
        });
    },
    
    // 开始编辑回复
    async startEditReply(replyId) {
        const replies = this.selectedMatter.replies || [];
        const reply = replies.find(r => r.id === replyId);
        if (!reply) return;
        
        this.editingReplyId = replyId;
        document.getElementById('reply-content').value = reply.content;
        document.getElementById('reply-author').value = reply.author || '';
        document.getElementById('submit-reply-btn').textContent = '保存编辑';
        document.getElementById('cancel-reply-edit-btn').style.display = 'inline-block';
        const titleEl = document.getElementById('reply-form-title');
        if (titleEl) titleEl.textContent = '✏️ 编辑回复';
        document.getElementById('reply-form').scrollIntoView({ behavior: 'smooth' });

        // 编辑模式下也遵守权限
        this.setupReplyAuthor();
    },
    
    // 取消编辑回复
    cancelEditReply() {
        this.editingReplyId = null;
        document.getElementById('reply-content').value = '';
        document.getElementById('reply-author').value = '';
        document.getElementById('reply-author').readOnly = false;
        document.getElementById('reply-author').style.background = '';
        document.getElementById('submit-reply-btn').textContent = '提交回复';
        document.getElementById('cancel-reply-edit-btn').style.display = 'none';
        const titleEl = document.getElementById('reply-form-title');
        if (titleEl) titleEl.textContent = '✏️ 添加回复';
        // 恢复输入框权限
        this.setupReplyAuthor();
    },
    
    // 删除回复
    async deleteReply(replyId) {
        if (!confirm('⚠️ 确定要删除这条回复吗？\n\n此操作不可恢复！')) return;
        await DataStore.deleteReply(this.selectedMatter.id, replyId);
        // 重新获取最新数据
        const matters = await DataStore.getMatters();
        const updated = matters.find(m => m.id === this.selectedMatter.id);
        if (updated) {
            this.selectedMatter = updated;
            this.renderReplies(updated);
        }
    },

    // 提交回复
    async submitReply() {
        const content = document.getElementById('reply-content').value.trim();
        const author = document.getElementById('reply-author').value.trim() || '匿名';
        if (!content) { alert('请输入回复内容'); return; }
        
        // 收集附件（从 pendingFiles 读取，支持删除后的最新列表）
        const attachments = [];
        const replyFiles = this.pendingFiles['reply-attachments-preview'] || [];
        if (replyFiles.length > 0) {
            for (const file of replyFiles) {
                const base64 = await this.fileToBase64(file);
                attachments.push({
                    name: file.name,
                    type: file.type.startsWith('image/') ? 'image' : 'file',
                    data: base64,
                    url: base64
                });
            }
        }
        
        if (this.selectedMatter) {
            if (this.editingReplyId) {
                // 编辑模式
                await DataStore.updateReply(this.selectedMatter.id, this.editingReplyId, { content, author, attachments });
                this.cancelEditReply();
            } else {
                // 新增模式
                await DataStore.addReply(this.selectedMatter.id, { content, author, attachments });
                document.getElementById('reply-content').value = '';
                // 清空回复附件预览
                this.pendingFiles['reply-attachments-preview'] = [];
                const replyPreview = document.getElementById('reply-attachments-preview');
                if (replyPreview) replyPreview.innerHTML = '';
                const replyInput = document.getElementById('reply-attachments');
                if (replyInput) replyInput.value = '';
            }

            // ✅ 核心逻辑：有回复 → 自动将「待处理」升级为「进行中」
            if (this.selectedMatter.status === 'pending' && !this.editingReplyId) {
                await DataStore.updateStatus(this.selectedMatter.id, 'in_progress');
            }

            // 重新获取最新数据后刷新回复列表
            const matters = await DataStore.getMatters();
            const updated = matters.find(m => m.id === this.selectedMatter.id);
            if (updated) {
                this.selectedMatter = updated;
                this.renderReplies(updated);
                // 在回复面板顶部的状态徽章也同步更新
                const statusMap = {
                    pending:     { text: '待处理', cls: 'status-pending' },
                    in_progress: { text: '进行中', cls: 'status-progress' },
                    completed:   { text: '已完成', cls: 'status-completed' },
                    blocked:     { text: '遇问题', cls: 'status-blocked' }
                };
                const st = statusMap[updated.status] || statusMap.pending;
                const badge = document.getElementById('reply-status-badge');
                if (badge) {
                    badge.textContent = st.text;
                    badge.className = `matter-status ${st.cls}`;
                }
            }
        }
    },

    // 加载设置
    async loadSettings() {
        const settings = await DataStore.getSettings();
        document.getElementById('push-time').value = settings.pushTime || '09:00';
        document.getElementById('push-enabled').checked = settings.pushEnabled !== false;
    },

    // 保存设置
    async saveSettings() {
        const pushTime = document.getElementById('push-time').value;
        const pushEnabled = document.getElementById('push-enabled').checked;
        await DataStore.updateSettings({ pushTime, pushEnabled });
        alert('设置已保存');
    },

    // 点击统计卡片筛选
    async clickStatFilter(status) {
        // 更新快捷筛选按钮状态
        document.querySelectorAll('.quick-status-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.status === status);
        });
        // 高亮统计卡片
        document.querySelectorAll('.stat-item').forEach(s => {
            s.classList.toggle('active', s.dataset.status === status);
        });
        await this.filterByStatus(status);
    },

    // 按状态筛选（本地过滤，优先用缓存，秒开）
    async filterByStatus(status, cachedMatters) {
        this.currentStatusFilter = status;

        // 优先用传入数据 > 缓存 > 网络
        let matters = cachedMatters || (this.matterCache.length > 0 ? this.matterCache : await DataStore.getMatters());
        this._renderFilteredList(matters, status);
        
        // 后台静默拉最新数据，有变化再刷新
        DataStore.getMatters().then(fresh => {
            if (fresh.length !== this.matterCache.length || 
                JSON.stringify(fresh.map(m => m.id + m.status + (m.replies||[]).length)) !== 
                JSON.stringify(this.matterCache.map(m => m.id + m.status + (m.replies||[]).length))) {
                this.matterCache = fresh;
                this._renderFilteredList(fresh, status);
            }
        }).catch(() => {});
    },

    // 内部：渲染筛选后的列表（带 diff 跳过和滚动保护）
    _renderFilteredList(matters, status) {
        this.matterCache = matters;
        let filtered = matters;

        // 应用状态筛选
        if (status !== 'all') {
            filtered = filtered.filter(m => m.status === status);
        }

        // 应用日期筛选
        if (this.dateFilter.start) {
            filtered = filtered.filter(m => new Date(m.createdAt) >= new Date(this.dateFilter.start));
        }
        if (this.dateFilter.end) {
            filtered = filtered.filter(m => new Date(m.createdAt) <= new Date(this.dateFilter.end + 'T23:59:59'));
        }

        const container = document.getElementById('matter-list');

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-text">没有找到匹配的事项</div>
                </div>`;
            return;
        }

        const sorted = [...filtered].sort((a, b) => {
            const order = { blocked: 0, pending: 1, in_progress: 2, completed: 3 };
            if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // 数据哈希比较，无变化则跳过 DOM 重绘
        const newDataHash = sorted.map(m => m.id + '_' + m.status + '_' + ((m.replies || []).length || m.replyCount || 0)).join('|');
        if (newDataHash === this._lastRenderHash && this.currentView === 'list') return;
        this._lastRenderHash = newDataHash;

        // 保存滚动位置
        const scrollTop = container.scrollTop;

        container.innerHTML = sorted.map(m => this.renderMatterCard(m)).join('');
        this.bindCardEvents();

        // 恢复滚动位置
        if (scrollTop > 0) container.scrollTop = scrollTop;
    },
    
    // 日期筛选
    async applyDateFilter() {
        this.dateFilter.start = document.getElementById('filter-start-date').value;
        this.dateFilter.end = document.getElementById('filter-end-date').value;
        
        // 获取当前选中的状态
        const activeBtn = document.querySelector('.quick-status-btn.active');
        const status = activeBtn ? activeBtn.dataset.status : 'all';
        
        await this.filterByStatus(status);
    },
    
    // 清除日期筛选
    async clearDateFilter() {
        document.getElementById('filter-start-date').value = '';
        document.getElementById('filter-end-date').value = '';
        this.dateFilter = { start: '', end: '' };
        await this.filterByStatus('all');
    },

    // 导出数据（JSON 格式）
    async exportData() {
        const matters = await DataStore.getMatters();
        const blob = new Blob([JSON.stringify({ matters }, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `matters-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    // 导出数据（Excel 格式）
    async exportExcel() {
        const matters = await DataStore.getMatters();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 准备表头
        const statusMap = {
            pending: '待处理',
            in_progress: '进行中',
            completed: '已完成',
            blocked: '遇问题'
        };
        
        // 准备数据
        const data = matters.map((m, idx) => {
            const created = new Date(m.createdAt);
            created.setHours(0, 0, 0, 0);
            const days = Math.floor((today - created) / (1000 * 60 * 60 * 24));
            const replyCount = (m.replies || []).length;
            const lastReply = (m.replies || []).slice(-1)[0];
            
            return [
                idx + 1,
                m.content,
                statusMap[m.status] || m.status,
                created.toLocaleDateString('zh-CN'),
                days,
                replyCount,
                lastReply ? `${lastReply.author}: ${lastReply.content.substring(0, 50)}...` : ''
            ];
        });
        
        // 添加表头
        const tableData = [
            ['序号', '事项内容', '状态', '创建日期', '已跟进天数', '回复数', '最新回复'],
            ...data
        ];
        
        // 创建工作表
        const ws = XLSX.utils.aoa_to_sheet(tableData);
        
        // 设置列宽
        ws['!cols'] = [
            { wch: 6 },   // 序号
            { wch: 40 },  // 事项内容
            { wch: 10 },  // 状态
            { wch: 12 },  // 创建日期
            { wch: 12 },  // 已跟进天数
            { wch: 8 },   // 回复数
            { wch: 40 }   // 最新回复
        ];
        
        // 创建工作簿
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '事项列表');
        
        // 导出文件
        const fileName = `事项列表_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
    },

    // 导出含附件的 ZIP 包
    async exportZip() {
        const btn = document.getElementById('export-zip-btn');
        const originalText = btn.textContent;
        btn.textContent = '打包中...';
        btn.disabled = true;

        try {
            const matters = await DataStore.getMatters();
            const zip = new JSZip();
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const statusMap = {
                pending: '待处理', in_progress: '进行中',
                completed: '已完成', blocked: '遇问题'
            };

            // 按事项分组，创建附件目录
            const attachmentsFolder = zip.folder('附件');

            // 准备 Excel 数据
            const data = matters.map((m, idx) => {
                const created = new Date(m.createdAt);
                created.setHours(0, 0, 0, 0);
                const days = Math.floor((today - created) / (1000 * 60 * 60 * 24));
                const replyCount = (m.replies || []).length;
                const lastReply = (m.replies || []).slice(-1)[0];

                // 收集该事项的所有附件文件名
                const matterAttNames = (m.attachments || []).map(a => a.name);
                const replyAttNames = [];
                (m.replies || []).forEach(r => {
                    (r.attachments || []).forEach(a => replyAttNames.push(a.name));
                });
                const allAttNames = [...matterAttNames, ...replyAttNames];

                // 创建该事项的附件子目录
                const safeName = `${idx + 1}-${m.content.substring(0, 30).replace(/[\\/:*?"<>|]/g, '_')}`;
                const matterFolder = attachmentsFolder.folder(safeName);

                // 添加事项附件
                (m.attachments || []).forEach((att, attIdx) => {
                    if (att.data) {
                        const ext = att.name.split('.').pop() || 'file';
                        const fileName = `事项附件_${attIdx + 1}_${att.name}`;
                        matterFolder.file(fileName, att.data.split(',')[1] || att.data, { base64: true });
                    }
                });

                // 添加回复附件
                (m.replies || []).forEach((r, rIdx) => {
                    (r.attachments || []).forEach((att, attIdx) => {
                        if (att.data) {
                            const fileName = `回复${rIdx + 1}_附件${attIdx + 1}_${att.name}`;
                            matterFolder.file(fileName, att.data.split(',')[1] || att.data, { base64: true });
                        }
                    });
                });

                return [
                    idx + 1,
                    m.content,
                    statusMap[m.status] || m.status,
                    created.toLocaleDateString('zh-CN'),
                    days,
                    replyCount,
                    lastReply ? `${lastReply.author}: ${lastReply.content.substring(0, 50)}...` : '',
                    allAttNames.join('、')
                ];
            });

            // 创建 Excel 工作表
            const tableData = [
                ['序号', '事项内容', '状态', '创建日期', '已跟进天数', '回复数', '最新回复', '附件列表'],
                ...data
            ];
            const ws = XLSX.utils.aoa_to_sheet(tableData);
            ws['!cols'] = [
                { wch: 6 }, { wch: 40 }, { wch: 10 },
                { wch: 12 }, { wch: 12 }, { wch: 8 },
                { wch: 40 }, { wch: 30 }
            ];
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, '事项列表');

            // Excel 加入 ZIP
            const excelBuf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            zip.file(`事项列表_${new Date().toISOString().split('T')[0]}.xlsx`, excelBuf);

            // 生成 ZIP 并下载
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `事项导出_${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('导出ZIP失败:', e);
            alert('导出失败: ' + e.message);
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },

    // 回复界面标记完成
    async replyMarkComplete(id) {
        await DataStore.updateStatus(id, 'completed');
        await this.refreshReplyView();
    },

    // 回复界面标记未完成
    async replyMarkUncomplete(id) {
        await DataStore.updateStatus(id, 'in_progress');
        await this.refreshReplyView();
    },

    // 回复界面标记遇问题
    async replyMarkBlocked(id) {
        await DataStore.updateStatus(id, 'blocked');
        await this.refreshReplyView();
    },

    // 刷新回复视图
    async refreshReplyView() {
        const matters = await DataStore.getMatters();
        const updated = matters.find(m => m.id === this.selectedMatter.id);
        if (updated) {
            this.selectedMatter = updated;
            this.renderReplies(updated);
        }
    },

    // 手动刷新
    async refresh() {
        const ok = await this.checkConnection();
        if (ok) await this.render();
        const btn = document.getElementById('refresh-btn');
        if (btn) {
            btn.textContent = ok ? '✓ 已刷新' : '⚠️ 无连接';
            setTimeout(() => { btn.textContent = '🔄 刷新'; }, 1500);
        }
    },

    // 每 5 秒自动轮询，合并请求减少后端压力
    startPolling() {
        this.pollInterval = setInterval(async () => {
            try {
                // 1. 只拉一次 stats，复用给 renderStats 和连接状态
                const statsRes = await DataStore.getStats();
                if (this.currentView === 'list') {
                    this.renderStats(statsRes);
                    this.updateConnectionIndicator(true);

                    // 2. 只拉一次轻量 matters（不含回复详情和附件数据）
                    const matters = await DataStore.getMattersLite();
                    await this.filterByStatus(this.currentStatusFilter, matters);
                    if (this.currentView !== 'replies') {
                        this.checkNewReplies(matters);
                    }
                } else {
                    // 非列表页也检查连接
                    this.updateConnectionIndicator(!!statsRes.total);
                }
            } catch (e) {
                // 网络异常时只更新连接指示器
                this.updateConnectionIndicator(false);
            }
        }, 5000);
    },

    // 更新连接指示器（不再单独发请求）
    updateConnectionIndicator(connected) {
        const indicator = document.getElementById('conn-indicator');
        if (indicator) {
            indicator.textContent = connected ? '🟢' : '🔴';
            indicator.title = connected ? '已连接' : '无连接';
        }
    },

        // 检查新回复并精准通知（支持轻量数据）
    async checkNewReplies(cachedMatters) {
        const user = DataStore.getCurrentUser();
        if (!user) return;
        try {
            const matters = cachedMatters || await DataStore.getMattersLite();
            // 兼容轻量格式(replyCount)和完整格式(replies数组)
            const getCount = (m) => (m.replies || []).length || m.replyCount || 0;
            const currentMatterId = this.selectedMatter ? this.selectedMatter.id : null;

            for (const matter of matters) {
                const key = `matter_reply_count_${matter.id}`;
                const prevCount = parseInt(localStorage.getItem(key) || '0', 10);
                const currCount = getCount(matter);

                    if (currCount > prevCount && prevCount > 0) {
                    // 有新回复 — 只更新 localStorage 计数，红点由 renderMatterCard 自动显示
                    // 不弹 toast/通知，保持界面简洁
                    if (this.currentView === 'replies' && currentMatterId === matter.id) {
                        // 正在查看该事项，静默标记已读
                        localStorage.setItem(key, currCount);
                    } else {
                        localStorage.setItem(key, currCount);
                    }
                } else if (currCount !== prevCount) {
                    localStorage.setItem(key, currCount);
                }
            }
            // 同步更新缓存
            this.matterCache = matters;
        } catch (e) {}
    },

    // 页面内 toast 提示
    showToast(message) {
        const old = document.querySelector('.reply-toast');
        if (old) old.remove();
        const el = document.createElement('div');
        el.className = 'reply-toast';
        el.textContent = message;
        el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 24px;border-radius:8px;z-index:10001;font-size:14px;box-shadow:0 4px 16px rgba(0,0,0,.2);animation:toastIn .3s ease-out;';
        document.body.appendChild(el);
        setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
    },

    // 尝试浏览器通知
    tryNotify(message) {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'granted') {
            new Notification('事项跟进提醒', { body: message, icon: '📋' });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    },

    // 停止轮询
    stopPolling() {
        if (this.pollInterval) clearInterval(this.pollInterval);
    },

    // 检查服务器连接状态，并更新指示器
    async checkConnection() {
        const indicator = document.getElementById('conn-indicator');
        try {
            const res = await fetch('/api/stats', { cache: 'no-store' });
            if (res.ok) {
                if (indicator) { indicator.textContent = '🟢'; indicator.title = '已连接'; }
                return true;
            }
        } catch (e) {}
        if (indicator) { indicator.textContent = '🔴'; indicator.title = '服务器未响应，数据可能不是最新'; }
        return false;
    },

    // 重置表单
    resetForm() {
        document.getElementById('matter-form').reset();
        this.editingMatter = null;
        document.getElementById('form-title').textContent = '添加事项';
        document.getElementById('existing-attachments').innerHTML = '';
        // 清除附件预览
        const previewContainer = document.getElementById('matter-attachments-preview');
        if (previewContainer) previewContainer.innerHTML = '';
        document.getElementById('matter-created-date').value = new Date().toISOString().split('T')[0];
    }
};

document.addEventListener('DOMContentLoaded', () => { App.init(); });
