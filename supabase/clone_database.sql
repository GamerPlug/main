-- ============================================================
-- GAMER PLUG SOLUTION - Consolidated Database Schema
-- Roles: admin, dealer, agent
-- New users always sign up as 'agent' — never trust metadata role
-- Admin has full bypass authority over all RLS policies
-- Run this in your Supabase Project's SQL Editor.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    first_name TEXT,
    last_name TEXT,
    phone_number TEXT,
    role TEXT DEFAULT 'agent',
    status TEXT DEFAULT 'active',
    requires_settlement BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop any existing role constraint and replace with the 3-role set
DO $$
DECLARE
    cname TEXT;
BEGIN
    SELECT conname INTO cname FROM pg_constraint
    WHERE conrelid = 'public.users'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%role%';
    IF cname IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.users DROP CONSTRAINT ' || cname;
    END IF;
    ALTER TABLE public.users ADD CONSTRAINT user_role_check
    CHECK (role IN ('admin', 'dealer', 'agent'));
END $$;

-- ============================================================
-- 2. WALLETS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    balance DECIMAL(12,2) DEFAULT 0,
    total_credited DECIMAL(12,2) DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    credit_limit DECIMAL(12,2) DEFAULT 0,
    unlimited_credit BOOLEAN DEFAULT false,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_wallet UNIQUE (user_id)
);

-- ============================================================
-- 3. DATA PACKAGES
-- price       = default/guest price
-- dealer_price = price for dealers
-- agent_price  = price for agents
-- cost_price   = admin's cost (used for profit calculation)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.data_packages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    network TEXT NOT NULL,
    size TEXT NOT NULL,
    price NUMERIC NOT NULL,
    dealer_price NUMERIC DEFAULT 0,
    agent_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    is_available BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. DOWNLOAD BATCHES (Admin offline export batches)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.download_batches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    filename TEXT NOT NULL,
    network TEXT,
    order_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE
);

-- ============================================================
-- 5. ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    package_id UUID REFERENCES public.data_packages(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    network TEXT,
    size TEXT,
    amount NUMERIC NOT NULL,
    price DECIMAL(12,2) DEFAULT 0,
    cost_price DECIMAL(12,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'unpaid',
    reference TEXT,
    reference_code TEXT,
    fulfillment_method TEXT DEFAULT 'auto',
    idempotency_key TEXT UNIQUE,
    download_batch_id UUID REFERENCES public.download_batches(id) ON DELETE SET NULL,
    email TEXT,
    customer_phone TEXT,
    provider_ref TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_id nullable to support guest (unregistered) purchases
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- ============================================================
-- 6. WALLET PAYMENTS (Top-ups via Paystack)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reference TEXT UNIQUE NOT NULL,
    amount NUMERIC NOT NULL,
    fee NUMERIC DEFAULT 0,
    total_amount NUMERIC,
    provider TEXT DEFAULT 'paystack',
    provider_reference TEXT,
    status TEXT DEFAULT 'pending',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. WALLET TRANSACTIONS (Ledger history)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_id UUID REFERENCES public.wallets(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    description TEXT,
    reference TEXT,
    source TEXT,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT,
    type TEXT,
    action_url TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. COMPLAINTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.complaints (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending',
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. SYSTEM ANNOUNCEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. ADMIN SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.admin_settings (key, value) VALUES
    ('paystack_fee_percent',         '1.95'),
    ('agent_paystack_fee_percent',   '1.95'),
    ('mtn_price_adjustment',         '0'),
    ('support_email',                'support@gamerplug.com'),
    ('support_whatsapp',             ''),
    ('whatsapp_group_link',          ''),
    ('whatsapp_channel_link',        ''),
    ('auto_fulfillment_enabled',     'true'),
    ('page_access_dashboard',        'true'),
    ('page_access_data_packages',    'true'),
    ('page_access_orders',           'true'),
    ('page_access_wallet',           'true'),
    ('page_access_complaints',       'true'),
    ('page_access_notifications',    'true'),
    ('page_access_profile',          'true'),
    ('guest_purchase_enabled',       'true'),
    ('wallet_topup_enabled',         'true')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 12. PHONE BLACKLIST
-- ============================================================
CREATE TABLE IF NOT EXISTS public.phone_blacklist (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. CUSTOMER PURCHASES (Repeat-buyer tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.customer_purchases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    customer_phone TEXT NOT NULL,
    total_purchases INTEGER DEFAULT 0,
    total_spent DECIMAL(12,2) DEFAULT 0,
    first_purchase_at TIMESTAMPTZ,
    last_purchase_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. API KEYS (Developer / programmatic access)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    key_prefix TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. MTN LOGS (MTN fulfillment audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.mtn_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    request_payload JSONB,
    response_payload JSONB,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. ISHARE LOGS (AirtelTigo iShare fulfillment audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ishare_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    request_payload JSONB,
    response_payload JSONB,
    status TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. PROFITS HISTORY (Admin profit tracking per order)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profits_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    network TEXT,
    sale_price DECIMAL(12,2) DEFAULT 0,
    cost_price DECIMAL(12,2) DEFAULT 0,
    profit DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_id        ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status          ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_network         ON public.orders(network);
CREATE INDEX IF NOT EXISTS idx_orders_created_at      ON public.orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency     ON public.orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_reference_code  ON public.orders(reference_code);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status  ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_user        ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet      ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_user        ON public.complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_purch_user    ON public.customer_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user          ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash          ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_mtn_logs_order         ON public.mtn_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_ishare_logs_order      ON public.ishare_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_profits_history_order  ON public.profits_history(order_id);


-- ============================================================
-- TRIGGER: Auto-create user profile + wallet on sign-up
-- Role is ALWAYS 'agent' — only admin can elevate roles later.
-- Never trust role values from signup metadata.
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        id, email, first_name, last_name, phone_number,
        role, status, created_at, updated_at
    )
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'first_name',
        new.raw_user_meta_data->>'last_name',
        new.raw_user_meta_data->>'phone_number',
        'agent',   -- hardcoded: all sign-ups are agents
        'active',
        NOW(),
        NOW()
    );
    INSERT INTO public.wallets (user_id, balance, total_credited, total_spent)
    VALUES (new.id, 0.00, 0.00, 0.00);
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- ============================================================
-- HELPER: is_admin()
-- Only the 'admin' role has elevated privileges.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Rule: users see/edit their own data only.
--       admin bypasses everything.
--       users cannot change their own role.
-- ============================================================

-- ---------- USERS ----------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile"         ON public.users;
DROP POLICY IF EXISTS "Admins can view all users"          ON public.users;
DROP POLICY IF EXISTS "Users can update own profile"       ON public.users;
DROP POLICY IF EXISTS "Admins can update any user"         ON public.users;
DROP POLICY IF EXISTS "Service role full access users"     ON public.users;
DROP POLICY IF EXISTS "Admins can insert users"            ON public.users;

CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT USING (public.is_admin(auth.uid()));

-- Users can update their own profile but cannot change their own role
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (
        role = (SELECT role FROM public.users WHERE id = auth.uid())
    );

-- Admin can update any user including role changes
CREATE POLICY "Admins can update any user" ON public.users
    FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert users" ON public.users
    FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- ---------- WALLETS ----------
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wallet"          ON public.wallets;
DROP POLICY IF EXISTS "Admins can view all wallets"        ON public.wallets;
DROP POLICY IF EXISTS "Admins can update any wallet"       ON public.wallets;

CREATE POLICY "Users can view own wallet" ON public.wallets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" ON public.wallets
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update any wallet" ON public.wallets
    FOR UPDATE USING (public.is_admin(auth.uid()));

-- ---------- DATA PACKAGES ----------
ALTER TABLE public.data_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read packages"         ON public.data_packages;
DROP POLICY IF EXISTS "Admins can manage packages"         ON public.data_packages;

CREATE POLICY "Everyone can read packages" ON public.data_packages
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage packages" ON public.data_packages
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- ORDERS ----------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own orders"          ON public.orders;
DROP POLICY IF EXISTS "Users can create own orders"        ON public.orders;
DROP POLICY IF EXISTS "Admins can view all orders"         ON public.orders;
DROP POLICY IF EXISTS "Admins can manage all orders"       ON public.orders;
DROP POLICY IF EXISTS "Guest orders are publicly viewable by reference" ON public.orders;

CREATE POLICY "Users can view own orders" ON public.orders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own orders" ON public.orders
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all orders" ON public.orders
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage all orders" ON public.orders
    FOR ALL USING (public.is_admin(auth.uid()));

-- Guest orders (no user_id) are readable by anyone for order tracking
CREATE POLICY "Guest orders are publicly viewable by reference" ON public.orders
    FOR SELECT USING (user_id IS NULL);

-- ---------- WALLET PAYMENTS ----------
ALTER TABLE public.wallet_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments"        ON public.wallet_payments;
DROP POLICY IF EXISTS "Users can create own payments"      ON public.wallet_payments;
DROP POLICY IF EXISTS "Admins can manage all payments"     ON public.wallet_payments;

CREATE POLICY "Users can view own payments" ON public.wallet_payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own payments" ON public.wallet_payments
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all payments" ON public.wallet_payments
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- WALLET TRANSACTIONS ----------
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own transactions"    ON public.wallet_transactions;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.wallet_transactions;

CREATE POLICY "Users can view own transactions" ON public.wallet_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all transactions" ON public.wallet_transactions
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- NOTIFICATIONS ----------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage notifications"    ON public.notifications;

CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage notifications" ON public.notifications
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- COMPLAINTS ----------
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own complaints"      ON public.complaints;
DROP POLICY IF EXISTS "Users can create complaints"        ON public.complaints;
DROP POLICY IF EXISTS "Admins can view all complaints"     ON public.complaints;
DROP POLICY IF EXISTS "Admins can update complaints"       ON public.complaints;

CREATE POLICY "Users can view own complaints" ON public.complaints
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create complaints" ON public.complaints
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all complaints" ON public.complaints
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update complaints" ON public.complaints
    FOR UPDATE USING (public.is_admin(auth.uid()));

-- ---------- SYSTEM ANNOUNCEMENTS ----------
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read active announcements" ON public.system_announcements;
DROP POLICY IF EXISTS "Admins can manage announcements"        ON public.system_announcements;

CREATE POLICY "Everyone can read active announcements" ON public.system_announcements
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage announcements" ON public.system_announcements
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- ADMIN SETTINGS ----------
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all users"     ON public.admin_settings;
DROP POLICY IF EXISTS "Everyone can read settings"         ON public.admin_settings;
DROP POLICY IF EXISTS "Allow write access to admins only"  ON public.admin_settings;

CREATE POLICY "Everyone can read settings" ON public.admin_settings
    FOR SELECT USING (true);

CREATE POLICY "Allow write access to admins only" ON public.admin_settings
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- DOWNLOAD BATCHES ----------
ALTER TABLE public.download_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to admins"        ON public.download_batches;
DROP POLICY IF EXISTS "Allow write access to admins"       ON public.download_batches;

CREATE POLICY "Allow read access to admins" ON public.download_batches
    FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Allow write access to admins" ON public.download_batches
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- PHONE BLACKLIST ----------
ALTER TABLE public.phone_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read blacklist"        ON public.phone_blacklist;
DROP POLICY IF EXISTS "Admins can manage blacklist"        ON public.phone_blacklist;

CREATE POLICY "Everyone can read blacklist" ON public.phone_blacklist
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage blacklist" ON public.phone_blacklist
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- CUSTOMER PURCHASES ----------
ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own customer purchases"    ON public.customer_purchases;
DROP POLICY IF EXISTS "Users can manage own customer purchases"  ON public.customer_purchases;
DROP POLICY IF EXISTS "Admins can manage all customer purchases" ON public.customer_purchases;

CREATE POLICY "Users can view own customer purchases" ON public.customer_purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own customer purchases" ON public.customer_purchases
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all customer purchases" ON public.customer_purchases
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- API KEYS ----------
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own api keys"      ON public.api_keys;
DROP POLICY IF EXISTS "Admins can manage all api keys"     ON public.api_keys;

CREATE POLICY "Users can manage own api keys" ON public.api_keys
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all api keys" ON public.api_keys
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- MTN LOGS ----------
ALTER TABLE public.mtn_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage mtn logs"         ON public.mtn_logs;

CREATE POLICY "Admins can manage mtn logs" ON public.mtn_logs
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- ISHARE LOGS ----------
ALTER TABLE public.ishare_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage ishare logs"      ON public.ishare_logs;

CREATE POLICY "Admins can manage ishare logs" ON public.ishare_logs
    FOR ALL USING (public.is_admin(auth.uid()));

-- ---------- PROFITS HISTORY ----------
ALTER TABLE public.profits_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage profits history"  ON public.profits_history;

CREATE POLICY "Admins can manage profits history" ON public.profits_history
    FOR ALL USING (public.is_admin(auth.uid()));


-- ============================================================
-- RPC FUNCTIONS: ATOMIC WALLET OPERATIONS
-- Both use SELECT ... FOR UPDATE to prevent race conditions.
-- ============================================================

-- Deduct from wallet — returns error if balance is insufficient
CREATE OR REPLACE FUNCTION deduct_wallet(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_new_balance NUMERIC;
BEGIN
    SELECT id, balance, total_spent
    INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'current_balance', v_wallet.balance,
            'requested_amount', p_amount
        );
    END IF;

    v_new_balance := v_wallet.balance - p_amount;

    UPDATE wallets
    SET balance     = v_new_balance,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at  = NOW()
    WHERE id = v_wallet.id;

    RETURN jsonb_build_object(
        'success',          true,
        'new_balance',      v_new_balance,
        'wallet_id',        v_wallet.id,
        'deducted_amount',  p_amount
    );
END;
$$;


-- Refund to wallet — used when a bulk order partially fails
CREATE OR REPLACE FUNCTION refund_wallet(
    p_user_id UUID,
    p_amount NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_new_balance NUMERIC;
BEGIN
    SELECT id, balance, total_spent
    INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    v_new_balance := v_wallet.balance + p_amount;

    UPDATE wallets
    SET balance     = v_new_balance,
        total_spent = GREATEST(COALESCE(total_spent, 0) - p_amount, 0),
        updated_at  = NOW()
    WHERE id = v_wallet.id;

    RETURN jsonb_build_object(
        'success',          true,
        'new_balance',      v_new_balance,
        'wallet_id',        v_wallet.id,
        'refunded_amount',  p_amount
    );
END;
$$;


-- ============================================================
-- DONE.
-- Roles   : admin (full access), dealer, agent (default on sign-up)
-- Removed : sub-admin, platinum, super dealer, super agent, user
-- Removed : memberships table (upgrade shop)
-- Removed : afa_orders table (AFA registration shop)
-- Removed : agent_upgrade_price, afa_price_* admin settings
-- ============================================================
