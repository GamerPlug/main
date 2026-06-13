-- ============================================================
-- SECURITY HARDENING MIGRATION
-- Run this in the Supabase SQL Editor.
-- Safe to re-run (idempotent guards used throughout).
--
-- Closes:
--   #1  Wallet RPCs callable by end users (infinite-money / wallet drain)
--   #4  Users editing their own status / requires_settlement (settlement bypass)
--   #5  All guest orders world-readable (PII scrape)
--   #8  cost_price (margins) readable by everyone
--   #10 Users inserting arbitrary orders (user_id IS NULL bypass)
-- ============================================================


-- ============================================================
-- FIX #1 — Lock down wallet RPCs
-- These are SECURITY DEFINER (bypass RLS). They must NOT be callable
-- by end users. Only trusted server code (service_role) may call them.
-- We also: pin search_path (prevents SECURITY DEFINER hijacking),
-- reject non-positive amounts, and keep the credit-limit semantics.
-- ============================================================

-- Drop first so we can guarantee the body/return type/grants are clean.
DROP FUNCTION IF EXISTS public.deduct_wallet(uuid, numeric);
DROP FUNCTION IF EXISTS public.refund_wallet(uuid, numeric);

CREATE FUNCTION public.deduct_wallet(p_user_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_new_balance NUMERIC;
BEGIN
    -- Reject invalid amounts up front
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    -- Lock the wallet row to prevent concurrent modification / double-spend
    SELECT id, balance, total_spent, credit_limit, unlimited_credit
    INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    -- Buying power = balance + credit_limit (unless unlimited credit)
    IF NOT COALESCE(v_wallet.unlimited_credit, FALSE)
       AND (v_wallet.balance + COALESCE(v_wallet.credit_limit, 0)) < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'current_balance', v_wallet.balance,
            'credit_limit', v_wallet.credit_limit,
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
        'success',         true,
        'new_balance',     v_new_balance,
        'wallet_id',       v_wallet.id,
        'deducted_amount', p_amount
    );
END;
$$;

CREATE FUNCTION public.refund_wallet(p_user_id uuid, p_amount numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet RECORD;
    v_new_balance NUMERIC;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

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
        'success',         true,
        'new_balance',     v_new_balance,
        'wallet_id',       v_wallet.id,
        'refunded_amount', p_amount
    );
END;
$$;

-- Remove the default PUBLIC EXECUTE grant and any role grants, then
-- grant ONLY to the privileged server roles. End users (anon/authenticated)
-- can no longer call these directly via PostgREST.
REVOKE ALL ON FUNCTION public.deduct_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_wallet(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_wallet(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_wallet(uuid, numeric) TO service_role;


-- ============================================================
-- FIX #4 — Users may not change their own role / status / requires_settlement
-- The previous WITH CHECK only pinned `role`, leaving status and
-- requires_settlement editable by the user (suspension + settlement bypass).
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role   = (SELECT u.role   FROM public.users u WHERE u.id = auth.uid())
        AND status = (SELECT u.status FROM public.users u WHERE u.id = auth.uid())
        AND requires_settlement IS NOT DISTINCT FROM
            (SELECT u.requires_settlement FROM public.users u WHERE u.id = auth.uid())
    );


-- ============================================================
-- FIX #5 — Guest orders must not be enumerable
-- Replace the blanket "user_id IS NULL is readable" policy with
-- SECURITY DEFINER lookups that only return a guest order when the
-- caller supplies the exact reference code (or the recipient phone).
-- ============================================================
DROP POLICY IF EXISTS "Guest orders are publicly viewable by reference" ON public.orders;

-- Look up a single guest order by its (unguessable) reference code.
CREATE OR REPLACE FUNCTION public.get_guest_order_by_reference(p_reference text)
RETURNS TABLE (
    id uuid,
    reference_code text,
    status text,
    payment_status text,
    network text,
    size text,
    phone_number text,
    price numeric,
    created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id, o.reference_code, o.status, o.payment_status,
           o.network, o.size, o.phone_number, o.price, o.created_at
    FROM public.orders o
    WHERE o.user_id IS NULL
      AND o.reference_code = p_reference
    LIMIT 1;
$$;

-- Look up the most recent guest order(s) for a recipient phone number.
CREATE OR REPLACE FUNCTION public.get_guest_orders_by_phone(p_phone text)
RETURNS TABLE (
    id uuid,
    reference_code text,
    status text,
    payment_status text,
    network text,
    size text,
    phone_number text,
    price numeric,
    created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT o.id, o.reference_code, o.status, o.payment_status,
           o.network, o.size, o.phone_number, o.price, o.created_at
    FROM public.orders o
    WHERE o.user_id IS NULL
      AND o.phone_number = p_phone
    ORDER BY o.created_at DESC
    LIMIT 5;
$$;

REVOKE ALL ON FUNCTION public.get_guest_order_by_reference(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_guest_orders_by_phone(text)    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_guest_order_by_reference(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_guest_orders_by_phone(text)    TO anon, authenticated, service_role;


-- ============================================================
-- FIX #10 — Authenticated users may only insert orders for themselves
-- Remove the "OR user_id IS NULL" bypass. Guest orders are created by
-- the server (service_role), which bypasses RLS, so this does not affect
-- the guest checkout flow.
-- ============================================================
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;

CREATE POLICY "Users can create own orders" ON public.orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- FIX #8 — Hide cost_price (admin margin) from end users
-- RLS still allows reading package rows, but column-level privilege
-- removes cost_price for anon/authenticated. Client code selects explicit
-- columns (no cost_price). Server routes use service_role and still see it.
-- ============================================================
REVOKE SELECT (cost_price) ON public.data_packages FROM anon, authenticated;


-- ============================================================
-- DONE.
-- After running, verify the wallet RPC lockdown:
--   SELECT proname, proacl FROM pg_proc
--   WHERE proname IN ('deduct_wallet','refund_wallet');
-- proacl should list service_role only (no anon/authenticated).
-- ============================================================
