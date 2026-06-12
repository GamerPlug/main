-- ============================================================
-- API Keys — Complete Safe Migration
-- Run this in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS and IF EXISTS guards.
-- ============================================================

-- 1. Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL,
    key_prefix TEXT NOT NULL DEFAULT 'easy_live_xxxxxxxxxx',
    key_preview TEXT NOT NULL DEFAULT 'easy_live_xxxxxxxxxx...',
    name TEXT NOT NULL DEFAULT 'API Key',
    is_active BOOLEAN NOT NULL DEFAULT true,
    rate_limit_override INTEGER NOT NULL DEFAULT 60,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Add UNIQUE constraint on key_hash if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'api_keys_key_hash_key'
          AND conrelid = 'public.api_keys'::regclass
    ) THEN
        ALTER TABLE public.api_keys ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);
    END IF;
END$$;

-- 3. Add each missing column individually (safe pattern)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='key_prefix') THEN
        ALTER TABLE public.api_keys ADD COLUMN key_prefix TEXT NOT NULL DEFAULT 'easy_live_xxxxxxxxxx';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='key_preview') THEN
        ALTER TABLE public.api_keys ADD COLUMN key_preview TEXT NOT NULL DEFAULT 'easy_live_xxxxxxxxxx...';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='name') THEN
        ALTER TABLE public.api_keys ADD COLUMN name TEXT NOT NULL DEFAULT 'API Key';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='is_active') THEN
        ALTER TABLE public.api_keys ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='rate_limit_override') THEN
        ALTER TABLE public.api_keys ADD COLUMN rate_limit_override INTEGER NOT NULL DEFAULT 60;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='last_used_at') THEN
        ALTER TABLE public.api_keys ADD COLUMN last_used_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='created_at') THEN
        ALTER TABLE public.api_keys ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='api_keys' AND column_name='updated_at') THEN
        ALTER TABLE public.api_keys ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END$$;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active);

-- 5. Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 6. Drop and recreate clean policies
DROP POLICY IF EXISTS "Users can view own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can manage own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Admins can manage all API keys" ON public.api_keys;
DROP POLICY IF EXISTS "users_select_own_keys" ON public.api_keys;
DROP POLICY IF EXISTS "users_delete_own_keys" ON public.api_keys;
DROP POLICY IF EXISTS "admins_select_all_keys" ON public.api_keys;
DROP POLICY IF EXISTS "admins_update_all_keys" ON public.api_keys;
DROP POLICY IF EXISTS "admins_delete_all_keys" ON public.api_keys;

CREATE POLICY "users_select_own_keys" ON public.api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_keys" ON public.api_keys
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "admins_select_all_keys" ON public.api_keys
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

CREATE POLICY "admins_update_all_keys" ON public.api_keys
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

CREATE POLICY "admins_delete_all_keys" ON public.api_keys
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'sub-admin'))
    );

-- 7. updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
