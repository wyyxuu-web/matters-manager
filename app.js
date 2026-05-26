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
    pendingFiles: {},      // 新上传附件的临时存储（用于支持删除）

    // 初始化
    async init() {
        await this.checkConnection();
        await this.render();
        Scheduler.init();
        this.bindEvents();
        this.startPolling(); // 每2秒自动刷新，实现多端同步
    },

    // 渲染界面
    async render() {
        await Promise.all([
            this.renderStats(),
            this.renderMatterList()
        ]);
    },

    // 渲染统计
    async renderStats() {
        const stats = await DataStore.getStats();
        document.getElementById('stats-container').innerHTML = `
            <div class="stat-item">
                <span class="stat-number">${stats.total}</span>
                <span class="stat-label">全部</span>
            </div>
            <div class="stat-item stat-pending">
                <span class="stat-number">${stats.pending}</span>
                <span class="stat-label">待处理</span>
            </div>
            <div class="stat-item stat-progress">
                <span class="stat-number">${stats.in_progress}</span>
                <span class="stat-label">进行中</span>
            </div>
            <div class="stat-item stat-blocked">
                <span class="stat-number">${stats.blocked}</span>
                <span class="stat-label">遇问题</span>
            </div>
            <div class="stat-item stat-completed">
                <span class="stat-number">${stats.completed}</span>
                <span class="stat-label">已完成</span>
            </div>
        `;
    },

    // 渲染事项列表
    async renderMatterList() {
        let matters = await DataStore.getMatters();
        
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

        container.innerHTML = sorted.map(m => this.renderMatterCard(m)).join('');
        this.bindCardEvents();
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
                    <span class="matter-meta-inline">📅 ${createdDateStr}（${daysSinceCreated}天）${hasAttachments ? ' 📎' : ''}</span>
                </div>
                <div class="matter-content">${matter.content}</div>
                ${hasAttachments ? this.renderAttachments(matter.attachments, 'card') : ''}
            </div>
            <div class="matter-footer">
                <span class="matter-replies" data-action="view-replies" data-id="${matter.id}">
                    💬 ${replyCount} 条回复
                </span>
                <div class="matter-actions">
                    ${actionButtons}
                    <button class="action-btn" data-action="edit" data-id="${matter.id}" title="编辑">✏️</button>
                    <button class="action-btn delete-btn" data-action="delete" data-id="${matter.id}" title="删除">🗑️</button>
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
        
        document.getElementById('add-btn').addEventListener('click', () => this.switchView('add'));
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());
        document.getElementById('save-btn').addEventListener('click', () => this.saveMatter());
        document.getElementById('cancel-btn').addEventListener('click', () => this.switchView('list'));
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
        document.getElementById('test-push-btn').addEventListener('click', () => Scheduler.manualPush());
        document.getElementById('export-btn').addEventListener('click', () => this.exportData());
        document.getElementById('export-excel-btn').addEventListener('click', () => this.exportExcel());
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
                this.filterByStatus(btn.dataset.status);
            });
        });
    },

    // 切换视图
    async switchView(view) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const target = document.getElementById(`${view}-view`);
        if (target) target.classList.add('active');
        this.currentView = view;
        if (view === 'list') await this.render();
        else if (view === 'settings') await this.loadSettings();
        else if (view === 'add' && !this.editingMatter) {
            // 新建时重置表单并设置今天为默认创建日期
            this.resetForm();
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
            // 新建时设置创建日期
            matterData.createdAt = createdDate + 'T' + new Date().toTimeString().slice(0, 8);
            await DataStore.addMatter(matterData);
        }

        btn.disabled = false;
        btn.textContent = '保存';
        this.resetForm();
        this.pendingFiles['matter-attachments-preview'] = [];
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
        const matters = await DataStore.getMatters();
        const matter = matters.find(m => m.id === id);
        if (matter) {
            this.selectedMatter = matter;
            this.renderReplies(matter);
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            document.getElementById('replies-view').classList.add('active');
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

        document.getElementById('reply-matter-info').innerHTML = `
            <div class="matter-brief">
                <span class="brief-content">${matter.content}</span>
                <span id="reply-status-badge" class="matter-status ${st.cls}">${st.text}</span>
                <span class="brief-meta">📅 ${createdDate}</span>
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
                    <div class="reply-actions">
                        <button class="reply-edit-btn" onclick="App.startEditReply('${r.id}')" title="编辑">✏️</button>
                        <button class="reply-delete-btn" onclick="App.deleteReply('${r.id}')" title="删除">🗑️</button>
                    </div>
                </div>
                <div class="reply-content">${r.content}</div>
                ${r.attachments && r.attachments.length > 0 ? this.renderReplyAttachments(r.attachments) : ''}
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
    },
    
    // 取消编辑回复
    cancelEditReply() {
        this.editingReplyId = null;
        document.getElementById('reply-content').value = '';
        document.getElementById('reply-author').value = '';
        document.getElementById('submit-reply-btn').textContent = '提交回复';
        document.getElementById('cancel-reply-edit-btn').style.display = 'none';
        const titleEl = document.getElementById('reply-form-title');
        if (titleEl) titleEl.textContent = '✏️ 添加回复';
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

    // 按状态筛选（本地过滤）
    async filterByStatus(status) {
        let matters = await DataStore.getMatters();
        
        // 应用状态筛选
        const filtered = status === 'all' ? matters : matters.filter(m => m.status === status);
        
        // 应用日期筛选
        if (this.dateFilter.start) {
            matters = filtered.filter(m => new Date(m.createdAt) >= new Date(this.dateFilter.start));
        } else {
            matters = filtered;
        }
        if (this.dateFilter.end) {
            matters = matters.filter(m => new Date(m.createdAt) <= new Date(this.dateFilter.end + 'T23:59:59'));
        }
        
        const container = document.getElementById('matter-list');

        if (matters.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🔍</div>
                    <div class="empty-text">没有找到匹配的事项</div>
                </div>`;
            return;
        }

        const sorted = [...matters].sort((a, b) => {
            const order = { blocked: 0, pending: 1, in_progress: 2, completed: 3 };
            if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

        container.innerHTML = sorted.map(m => this.renderMatterCard(m)).join('');
        this.bindCardEvents();
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

    // 每 2 秒自动轮询，实现多端数据同步
    startPolling() {
        this.pollInterval = setInterval(async () => {
            if (this.currentView === 'list') {
                const ok = await this.checkConnection();
                if (ok) await this.render();
            }
        }, 2000);
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
