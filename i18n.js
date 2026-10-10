/**
 * i18n.js - 中英文双语支持
 * 用法：
 *   t('key')                 取当前语言文案
 *   t('key', { n: 5 })       带变量插值（对应文案中的 {n}）
 *   Lang.toggle()            切换中/英
 *   Lang.locale()            当前 locale（'zh-CN' / 'en-US'）
 * 静态元素加属性：
 *   data-i18n="key"          替换 textContent
 *   data-i18n-placeholder    替换 placeholder
 *   data-i18n-title          替换 title
 */

const I18N = {
    zh: {
        // ===== 标题 / 通用 =====
        appTitle: '事项跟进管理系统',
        refresh: '🔄 刷新',
        refreshed: '✓ 已刷新',
        offlineShort: '⚠️ 无连接',
        connected: '已连接',
        disconnected: '无连接',
        serverNoResponse: '服务器未响应，数据可能不是最新',
        langButton: '🌐 EN',

        // ===== 登录 =====
        loginSubtitle: '请登录以继续',
        username: '用户名',
        phUsername: '请输入用户名',
        password: '密码',
        phPassword: '请输入密码',
        login: '登录',
        loggingIn: '登录中...',
        noAccount: '没有账号？',
        register: '注册',
        registering: '注册中...',

        // ===== 注册 =====
        registerTitle: '注册新账号',
        registerSubtitle: '需要有效的邀请码才能注册',
        phSetUsername: '请设置用户名',
        phSetPassword: '请设置密码（至少4位）',
        inviteCode: '邀请码',
        phInviteCode: '请输入邀请码',
        haveAccount: '已有账号？',
        backToLogin: '返回登录',

        // ===== 状态 / 筛选 =====
        statusAll: '全部',
        statusPending: '待处理',
        statusInProgress: '进行中',
        statusBlocked: '遇问题',
        statusCompleted: '已完成',
        statusAllBtn: '全部',
        statusPendingBtn: '⏳ 待处理',
        statusInProgressBtn: '🔄 进行中',
        statusBlockedBtn: '🚧 遇问题',
        statusCompletedBtn: '✅ 已完成',
        filterByDate: '📅 按创建日期筛选：',
        to: '至',
        filter: '筛选',
        clear: '清除',
        phSearch: '🔍 搜索事项内容...',
        clearSearch: '清除搜索',
        noMatch: '没有找到匹配的事项',

        // ===== 列表 / 卡片 =====
        emptyMatters: '暂无事项',
        emptyMattersHint: '点击上方「添加事项」开始',
        addMatter: '+ 添加事项',
        overWeek: '⚠️ 超过一周',
        over3Days: '⏰ 超过3天',
        newReply: '有新回复',
        viewDetail: '点击查看详情',
        edit: '编辑',
        delete: '删除',
        deleting: '删除中...',
        dayUnit: '天',
        replyUnit: ' 条回复',
        markComplete: '✅ 完成',
        markUncomplete: '↩️ 未完成',
        markBlocked: '🚧 遇问题',
        markCompleteTitle: '标记为已完成',
        markUncompleteTitle: '标记为未完成',
        markBlockedTitle: '标记为遇问题',

        // ===== 添加/编辑事项 =====
        addMatterTitle: '添加事项',
        editMatterTitle: '编辑事项',
        matterContent: '事项内容 *',
        phMatterContent: '请输入待跟进的事项内容...',
        createdDate: '创建日期 *',
        attachmentsLabel: '附件（图片或文件）',
        clickOrDrag: '点击选择文件或拖拽到此处',
        fileHint: '支持图片、PDF、Word、Excel、压缩包等',
        cancel: '取消',
        save: '保存',
        saving: '保存中...',
        selectedFiles: '已选择 {n} 个文件',

        // ===== 设置 =====
        pushSettings: '🔔 推送设置',
        enablePush: '启用定时推送',
        enablePushHint: '每天自动推送待跟进事项清单',
        pushTime: '推送时间',
        pushTimeHint: '每天自动推送的时间点',
        testPush: '测试推送',
        saveSettings: '保存设置',
        settingsSaved: '设置已保存',
        dataManagement: '💾 数据管理',
        exportJson: '📥 导出 JSON',
        exportExcel: '📊 导出 Excel',
        exportZip: '📦 导出含附件ZIP',
        clearData: '🗑️ 清空数据',
        confirmClear: '确定要清空所有数据吗？此操作不可恢复！',
        changePassword: '🔑 修改密码',
        oldPassword: '原密码',
        phOldPassword: '请输入原密码',
        newPassword: '新密码',
        phNewPassword: '请输入新密码（至少4位）',
        changePasswordBtn: '修改密码',
        changingPassword: '修改中...',
        pwdChanged: '密码修改成功',
        inviteManagement: '📨 邀请码管理',
        generateInvite: '生成邀请码',
        generating: '生成中...',
        newInvite: '新邀请码：{code}',
        userManagement: '👥 用户管理',
        noInvites: '暂无邀请码',
        noUsers: '暂无用户',

        // ===== 邀请码 / 用户表 =====
        colInviteCode: '邀请码',
        colInviteStatus: '状态',
        colInviteUser: '使用者',
        colInviteTime: '使用时间',
        used: '已使用',
        available: '可用',
        colUsername: '用户名',
        colRole: '角色',
        colRegTime: '注册时间',
        colAction: '操作',
        roleAdmin: '管理员',
        roleUser: '用户',
        currentAccount: '当前账号',

        // ===== 回复 =====
        replyRecords: '💬 回复记录',
        addReply: '✏️ 添加回复',
        editReplyTitle: '✏️ 编辑回复',
        phReplyAuthor: '回复者姓名（选填）',
        phReplyAuthorEditable: '回复者姓名（可编辑）',
        nameLocked: '名字已锁定为你的用户名',
        phReplyContent: '请输入回复内容...',
        clickAddAttachment: '点击添加附件',
        cancelEdit: '取消编辑',
        submitReply: '提交回复',
        saveEdit: '保存编辑',
        backToList: '← 返回列表',
        backToListTitle: '返回列表',
        emptyReplies: '暂无回复，收到推送后可在此回复',
        anonymous: '匿名',
        notificationTitle: '事项跟进提醒',
        previewImage: '预览',

        // ===== 底部导航 =====
        navMatters: '📋 事项',
        navSettings: '⚙️ 设置',
        logout: '🚪 退出',

        // ===== 提示 / 错误 =====
        errEnterUserPass: '请输入用户名和密码',
        errLoginFailed: '登录失败',
        errFillAll: '请填写所有字段',
        errPwdLen: '密码长度至少4位',
        errNewPwdLen: '新密码长度至少4位',
        regSuccess: '注册成功！请返回登录页面登录。',
        errRegFailed: '注册失败',
        errEnterOldNew: '请填写原密码和新密码',
        errChangeFailed: '修改失败',
        errGenFailed: '生成失败',
        errEnterMatterContent: '请输入事项内容',
        errSelectDate: '请选择创建日期',
        errEnterReply: '请输入回复内容',
        confirmDeleteMatter: '⚠️ 确定要删除这个事项吗？\n\n此操作不可恢复！',
        confirmDeleteReply: '⚠️ 确定要删除这条回复吗？\n\n此操作不可恢复！',
        confirmDeleteUser: '确定要删除用户「{name}」吗？此操作不可撤销。',
        userDeleted: '用户「{name}」已删除',
        deleteFailed: '删除失败：',
        unknownError: '未知错误',

        // ===== 导出 =====
        packaging: '打包中...',
        exportFailed: '导出失败: ',
        colIndex: '序号',
        colContent: '事项内容',
        colStatus: '状态',
        colCreated: '创建日期',
        colDays: '已跟进天数',
        colReplyCount: '回复数',
        colLastReply: '最新回复',
        colAttachments: '附件列表',
        sheetItems: '事项列表',
        folderAttachments: '附件',
        fileXlsxPrefix: '事项列表',
        fileZipPrefix: '事项导出',
        matterAttachmentPrefix: '事项附件',
        replyAttachmentPrefix: '回复{idx}_附件',
        fileListSeparator: '、'
    },

    en: {
        // ===== Title / General =====
        appTitle: 'Matter Tracker',
        refresh: '🔄 Refresh',
        refreshed: '✓ Refreshed',
        offlineShort: '⚠️ Offline',
        connected: 'Connected',
        disconnected: 'Disconnected',
        serverNoResponse: 'Server not responding; data may be outdated',
        langButton: '🌐 中文',

        // ===== Login =====
        loginSubtitle: 'Please sign in to continue',
        username: 'Username',
        phUsername: 'Enter username',
        password: 'Password',
        phPassword: 'Enter password',
        login: 'Sign In',
        loggingIn: 'Signing in...',
        noAccount: 'No account?',
        register: 'Sign Up',
        registering: 'Signing up...',

        // ===== Register =====
        registerTitle: 'Create Account',
        registerSubtitle: 'A valid invite code is required to register',
        phSetUsername: 'Choose a username',
        phSetPassword: 'Set a password (min 4 characters)',
        inviteCode: 'Invite Code',
        phInviteCode: 'Enter invite code',
        haveAccount: 'Already have an account?',
        backToLogin: 'Back to Sign In',

        // ===== Status / Filter =====
        statusAll: 'All',
        statusPending: 'Pending',
        statusInProgress: 'In Progress',
        statusBlocked: 'Blocked',
        statusCompleted: 'Completed',
        statusAllBtn: 'All',
        statusPendingBtn: '⏳ Pending',
        statusInProgressBtn: '🔄 In Progress',
        statusBlockedBtn: '🚧 Blocked',
        statusCompletedBtn: '✅ Completed',
        filterByDate: '📅 Filter by created date:',
        to: 'to',
        filter: 'Filter',
        clear: 'Clear',
        phSearch: '🔍 Search items...',
        clearSearch: 'Clear search',
        noMatch: 'No matching items found',

        // ===== List / Card =====
        emptyMatters: 'No items yet',
        emptyMattersHint: 'Click "Add Item" above to start',
        addMatter: '+ Add Item',
        overWeek: '⚠️ Over a week',
        over3Days: '⏰ Over 3 days',
        newReply: 'New reply',
        viewDetail: 'Click to view details',
        edit: 'Edit',
        delete: 'Delete',
        deleting: 'Deleting...',
        dayUnit: 'd',
        replyUnit: ' replies',
        markComplete: '✅ Complete',
        markUncomplete: '↩️ Not Done',
        markBlocked: '🚧 Blocked',
        markCompleteTitle: 'Mark as completed',
        markUncompleteTitle: 'Mark as not done',
        markBlockedTitle: 'Mark as blocked',

        // ===== Add / Edit matter =====
        addMatterTitle: 'Add Item',
        editMatterTitle: 'Edit Item',
        matterContent: 'Item Content *',
        phMatterContent: 'Enter the item to follow up...',
        createdDate: 'Created Date *',
        attachmentsLabel: 'Attachments (images or files)',
        clickOrDrag: 'Click to choose files or drag here',
        fileHint: 'Supports images, PDF, Word, Excel, archives, etc.',
        cancel: 'Cancel',
        save: 'Save',
        saving: 'Saving...',
        selectedFiles: '{n} file(s) selected',

        // ===== Settings =====
        pushSettings: '🔔 Push Settings',
        enablePush: 'Enable scheduled push',
        enablePushHint: 'Push the pending list automatically every day',
        pushTime: 'Push Time',
        pushTimeHint: 'Time of the daily automatic push',
        testPush: 'Test Push',
        saveSettings: 'Save Settings',
        settingsSaved: 'Settings saved',
        dataManagement: '💾 Data Management',
        exportJson: '📥 Export JSON',
        exportExcel: '📊 Export Excel',
        exportZip: '📦 Export ZIP (with attachments)',
        clearData: '🗑️ Clear All Data',
        confirmClear: 'Clear all data? This cannot be undone!',
        changePassword: '🔑 Change Password',
        oldPassword: 'Current Password',
        phOldPassword: 'Enter current password',
        newPassword: 'New Password',
        phNewPassword: 'Enter new password (min 4 characters)',
        changePasswordBtn: 'Change Password',
        changingPassword: 'Changing...',
        pwdChanged: 'Password changed successfully',
        inviteManagement: '📨 Invite Code Management',
        generateInvite: 'Generate Invite Code',
        generating: 'Generating...',
        newInvite: 'New invite code: {code}',
        userManagement: '👥 User Management',
        noInvites: 'No invite codes',
        noUsers: 'No users',

        // ===== Invite / User tables =====
        colInviteCode: 'Invite Code',
        colInviteStatus: 'Status',
        colInviteUser: 'Used By',
        colInviteTime: 'Used At',
        used: 'Used',
        available: 'Available',
        colUsername: 'Username',
        colRole: 'Role',
        colRegTime: 'Registered',
        colAction: 'Action',
        roleAdmin: 'Admin',
        roleUser: 'User',
        currentAccount: 'Current account',

        // ===== Replies =====
        replyRecords: '💬 Replies',
        addReply: '✏️ Add Reply',
        editReplyTitle: '✏️ Edit Reply',
        phReplyAuthor: 'Your name (optional)',
        phReplyAuthorEditable: 'Your name (editable)',
        nameLocked: 'Name is locked to your username',
        phReplyContent: 'Enter your reply...',
        clickAddAttachment: 'Click to add attachments',
        cancelEdit: 'Cancel Edit',
        submitReply: 'Submit Reply',
        saveEdit: 'Save Edit',
        backToList: '← Back to List',
        backToListTitle: 'Back to list',
        emptyReplies: 'No replies yet',
        anonymous: 'Anonymous',
        notificationTitle: 'Matter Reminder',
        previewImage: 'Preview',

        // ===== Bottom nav =====
        navMatters: '📋 Items',
        navSettings: '⚙️ Settings',
        logout: '🚪 Sign Out',

        // ===== Messages / Errors =====
        errEnterUserPass: 'Enter username and password',
        errLoginFailed: 'Sign in failed',
        errFillAll: 'Please fill in all fields',
        errPwdLen: 'Password must be at least 4 characters',
        errNewPwdLen: 'New password must be at least 4 characters',
        regSuccess: 'Registration successful! Please sign in.',
        errRegFailed: 'Registration failed',
        errEnterOldNew: 'Enter current and new password',
        errChangeFailed: 'Change failed',
        errGenFailed: 'Generation failed',
        errEnterMatterContent: 'Enter item content',
        errSelectDate: 'Select a created date',
        errEnterReply: 'Enter reply content',
        confirmDeleteMatter: '⚠️ Delete this item?\n\nThis cannot be undone!',
        confirmDeleteReply: '⚠️ Delete this reply?\n\nThis cannot be undone!',
        confirmDeleteUser: 'Delete user "{name}"? This cannot be undone.',
        userDeleted: 'User "{name}" deleted',
        deleteFailed: 'Delete failed: ',
        unknownError: 'Unknown error',

        // ===== Export =====
        packaging: 'Packaging...',
        exportFailed: 'Export failed: ',
        colIndex: 'No.',
        colContent: 'Content',
        colStatus: 'Status',
        colCreated: 'Created',
        colDays: 'Days',
        colReplyCount: 'Replies',
        colLastReply: 'Latest Reply',
        colAttachments: 'Attachments',
        sheetItems: 'Items',
        folderAttachments: 'attachments',
        fileXlsxPrefix: 'items',
        fileZipPrefix: 'items-export',
        matterAttachmentPrefix: 'item-attachment',
        replyAttachmentPrefix: 'reply{idx}-attachment',
        fileListSeparator: ', '
    }
};

// 当前语言：'zh' | 'en'
const Lang = {
    current: 'zh',

    get() {
        try {
            const saved = localStorage.getItem('app_lang');
            if (saved === 'en' || saved === 'zh') return saved;
        } catch (e) {}
        return 'zh';
    },

    set(lang) {
        this.current = (lang === 'en') ? 'en' : 'zh';
        try { localStorage.setItem('app_lang', this.current); } catch (e) {}
        this.apply();
        // 通知主应用重渲染动态内容
        if (typeof App !== 'undefined' && App.onLangChange) {
            App.onLangChange();
        }
    },

    toggle() {
        this.set(this.current === 'zh' ? 'en' : 'zh');
    },

    locale() {
        return this.current === 'en' ? 'en-US' : 'zh-CN';
    },

    // 应用静态 DOM 上的 data-i18n
    apply() {
        document.documentElement.lang = this.current === 'en' ? 'en' : 'zh-CN';
        document.title = t('appTitle');

        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.getAttribute('data-i18n'));
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.getAttribute('data-i18n-title'));
        });

        // 更新语言切换按钮文案（支持多处）
        document.querySelectorAll('.lang-toggle').forEach(btn => {
            btn.textContent = t('langButton');
        });
    },

    init() {
        this.current = this.get();
        this.apply();
    }
};

// 翻译函数（带 {var} 插值）
function t(key, params) {
    const dict = I18N[Lang.current] || I18N.zh;
    let str = dict[key];
    if (str === undefined) str = (I18N.zh[key] !== undefined ? I18N.zh[key] : key);
    if (params) {
        str = str.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined ? params[k] : m));
    }
    return str;
}
