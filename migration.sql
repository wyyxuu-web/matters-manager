-- 事项跟进管理系统 - Supabase 数据库 Schema
-- 请在 Supabase SQL Editor 中执行此文件
-- https://supabase.com/dashboard/project/piwebuchomdywncfgyuq/sql/new

-- 事项表
CREATE TABLE IF NOT EXISTS matters (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT
);

-- 回复表
CREATE TABLE IF NOT EXISTS replies (
    id TEXT PRIMARY KEY,
    matter_id TEXT NOT NULL REFERENCES matters(id) ON DELETE CASCADE,
    content TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '匿名',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 附件表（base64 数据）
CREATE TABLE IF NOT EXISTS attachments (
    id TEXT PRIMARY KEY,
    matter_id TEXT REFERENCES matters(id) ON DELETE CASCADE,
    reply_id TEXT REFERENCES replies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'file',
    data TEXT NOT NULL DEFAULT ''
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);

-- 默认设置
INSERT INTO settings (key, value)
VALUES ('pushTime', '09:00'), ('pushEnabled', 'true')
ON CONFLICT (key) DO NOTHING;

-- 索引
CREATE INDEX IF NOT EXISTS idx_replies_matter_id ON replies(matter_id);
CREATE INDEX IF NOT EXISTS idx_attachments_matter_id ON attachments(matter_id);
CREATE INDEX IF NOT EXISTS idx_attachments_reply_id ON attachments(reply_id);
CREATE INDEX IF NOT EXISTS idx_matters_created_by ON matters(created_by);

-- ============================================================
-- 用户认证系统（新增）
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 邀请码表
CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    used_by TEXT,
    used_at TIMESTAMPTZ,
    created_by TEXT NOT NULL DEFAULT 'admin',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);

-- 启用行级安全（RLS）并允许 anon key 操作
ALTER TABLE matters ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（因为是单用户应用，anon key 即可）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all on matters' AND polrelid = 'matters'::regclass) THEN
    CREATE POLICY "Allow all on matters" ON matters FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all on replies' AND polrelid = 'replies'::regclass) THEN
    CREATE POLICY "Allow all on replies" ON replies FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all on attachments' AND polrelid = 'attachments'::regclass) THEN
    CREATE POLICY "Allow all on attachments" ON attachments FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all on settings' AND polrelid = 'settings'::regclass) THEN
    CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all on users' AND polrelid = 'users'::regclass) THEN
    CREATE POLICY "Allow all on users" ON users FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Allow all on invite_codes' AND polrelid = 'invite_codes'::regclass) THEN
    CREATE POLICY "Allow all on invite_codes" ON invite_codes FOR ALL USING (true);
  END IF;
END
$$;
