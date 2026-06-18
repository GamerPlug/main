-- ============================================================
-- AUTH-ONLY HARDENING MIGRATION
-- Run this in the Supabase SQL Editor. Safe to re-run (idempotent).
--
-- Goes with the auth-only refactor:
--   * Removes the guest-order lookup RPCs (phone enumeration / PII leak).
--   * Adds row-locked, service-role-only wallet RPCs so admin balance ops
--     are atomic (fixes read-modify-write TOCTOU races).
--   * Re-asserts the critical orders / users RLS policies.
-- ============================================================


-- ============================================================
-- 1. Remove guest-order RPCs (guest checkout has been deleted)
--    `get_guest_orders_by_phone` let anyone enumerate orders by a
--    guessable phone number. With guest gone these are dead + dangerous.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_guest_order_by_reference(text);
DROP FUNCTION IF EXISTS public.get_guest_orders_by_phone(text);

-- Drop the now-unused feature flag.
DELETE FROM public.admin_settings WHERE key = 'guest_purchase_enabled';


-- ============================================================
-- 2. Atomic wallet adjustment (credit/debit) — service_role only
--    Replaces the JS "read balance, compute, write" pattern in the admin
--    wallet routes, which could lose updates under concurrent requests.
--    Locks the wallet row FOR UPDATE so concurrent ops serialize.
-- ============================================================
CREATE OR REPLACE FUNCTION public.adjust_wallet_balance(
    p_user_id uuid,
    p_amount  numeric,
    p_type    text  -- 'credit' | 'debit'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet      RECORD;
    v_new_balance NUMERIC;
    v_buying_power NUMERIC;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
    END IF;

    IF p_type NOT IN ('credit', 'debit') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid type');
    END IF;

    SELECT id, balance, total_credited, total_spent, credit_limit, unlimited_credit
    INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF p_type = 'credit' THEN
        v_new_balance := v_wallet.balance + p_amount;
        UPDATE wallets
        SET balance        = v_new_balance,
            total_credited = COALESCE(total_credited, 0) + p_amount,
            updated_at     = NOW()
        WHERE id = v_wallet.id;
    ELSE
        -- debit: buying power = balance + credit_limit (unless unlimited)
        v_buying_power := v_wallet.balance + COALESCE(v_wallet.credit_limit, 0);
        IF NOT COALESCE(v_wallet.unlimited_credit, FALSE) AND v_buying_power < p_amount THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Insufficient balance',
                'current_balance', v_wallet.balance,
                'credit_limit', v_wallet.credit_limit
            );
        END IF;
        v_new_balance := v_wallet.balance - p_amount;
        UPDATE wallets
        SET balance     = v_new_balance,
            total_spent = COALESCE(total_spent, 0) + p_amount,
            updated_at  = NOW()
        WHERE id = v_wallet.id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'wallet_id', v_wallet.id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_wallet_balance(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_wallet_balance(uuid, numeric, text) TO service_role;


-- ============================================================
-- 3. Atomic settlement (zero a negative balance + clear flag)
--    Service_role only. Locks the wallet row so the settlement amount is
--    computed and applied without a race against concurrent debits.
-- ============================================================
CREATE OR REPLACE FUNCTION public.settle_wallet_to_zero(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_wallet     RECORD;
    v_settlement NUMERIC := 0;
BEGIN
    SELECT id, balance, total_credited
    INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
    END IF;

    IF v_wallet.balance < 0 THEN
        v_settlement := ABS(v_wallet.balance);
        UPDATE wallets
        SET balance        = 0,
            total_credited = COALESCE(total_credited, 0) + v_settlement,
            updated_at     = NOW()
        WHERE id = v_wallet.id;
    END IF;

    UPDATE users SET requires_settlement = false WHERE id = p_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'wallet_id', v_wallet.id,
        'settled_amount', v_settlement
    );
END;
$$;

REVOKE ALL ON FUNCTION public.settle_wallet_to_zero(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_wallet_to_zero(uuid) TO service_role;


-- ============================================================
-- 4. Re-assert critical RLS (idempotent) — auth-only platform
--    Orders may only be inserted by their owner; users may not edit their
--    own role / status / requires_settlement.
-- ============================================================
DROP POLICY IF EXISTS "Users can create own orders" ON public.orders;
CREATE POLICY "Users can create own orders" ON public.orders
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

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

-- DONE.
