-- ============================================================
-- NOTIFICATIONS + WEB PUSH + PWA MIGRATION
-- Run this in the Supabase SQL Editor.
-- Idempotent: safe to run multiple times.
--
-- Adds:
--   1. notifications upgrades (metadata, priority, read_at) + DELETE policy + index
--   2. push_subscriptions table (Web Push endpoints per user)
--   3. notification_preferences table (per-user category opt-in/out)
--   4. system_announcements targeting (target_role, send_push)
-- ============================================================

-- ============================================================
-- 1. NOTIFICATIONS — column upgrades, index, DELETE policy
-- ============================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at   TIMESTAMPTZ;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata  JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority  TEXT  DEFAULT 'normal';

-- Fast unread-count + ordered fetch per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON public.notifications (user_id, is_read, created_at DESC);

-- Dedupe lookups by metadata->>'dedupe_key'
CREATE INDEX IF NOT EXISTS idx_notifications_dedupe
    ON public.notifications ((metadata->>'dedupe_key'))
    WHERE metadata ? 'dedupe_key';

-- BUG FIX (B1): users could never actually delete their own notifications
-- because no DELETE policy existed. The UI delete buttons silently no-op'd.
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications" ON public.notifications
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- 2. PUSH SUBSCRIPTIONS (Web Push)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint     TEXT NOT NULL UNIQUE,
    p256dh       TEXT NOT NULL,
    auth         TEXT NOT NULL,
    user_agent   TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
    ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own push subscriptions"   ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Admins can manage push subscriptions"    ON public.push_subscriptions;

CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage push subscriptions" ON public.push_subscriptions
    FOR ALL USING (public.is_admin(auth.uid()));

-- ============================================================
-- 3. NOTIFICATION PREFERENCES (per-user opt-in/out)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    user_id       UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    order_updates BOOLEAN DEFAULT true,
    payments      BOOLEAN DEFAULT true,
    security      BOOLEAN DEFAULT true,
    announcements BOOLEAN DEFAULT true,
    marketing     BOOLEAN DEFAULT false,   -- opt-in only
    push_enabled  BOOLEAN DEFAULT true,
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notification prefs"   ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification prefs" ON public.notification_preferences;
DROP POLICY IF EXISTS "Admins can manage notification prefs"    ON public.notification_preferences;

CREATE POLICY "Users can view own notification prefs" ON public.notification_preferences
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification prefs" ON public.notification_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification prefs" ON public.notification_preferences
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage notification prefs" ON public.notification_preferences
    FOR ALL USING (public.is_admin(auth.uid()));

-- ============================================================
-- 4. SYSTEM ANNOUNCEMENTS — targeting + push toggle
-- ============================================================
ALTER TABLE public.system_announcements ADD COLUMN IF NOT EXISTS target_role TEXT    DEFAULT 'all';
ALTER TABLE public.system_announcements ADD COLUMN IF NOT EXISTS send_push   BOOLEAN DEFAULT true;

-- ============================================================
-- DONE
-- ============================================================
