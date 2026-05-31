-- ==========================================
-- AGENT CREDIT & AUTO-SETTLEMENT SYSTEM
-- ==========================================

-- 1. Add credit_limit to wallets table
-- This allows agents to have a negative balance up to this limit.
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS credit_limit DECIMAL DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS unlimited_credit BOOLEAN DEFAULT FALSE;

-- 2. FIX MISSING COLUMNS in orders table (Compatibility with API)
-- Some versions of the schema might be missing the bundle_name column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bundle_name TEXT;

-- 3. Update deduct_wallet RPC to support credit limits
-- This allows agents to have a negative balance up to their credit limit.
-- Drop the existing function first because we are changing the return type (from VOID/INTERNAL to JSON)
DROP FUNCTION IF EXISTS public.deduct_wallet(uuid,numeric);

CREATE OR REPLACE FUNCTION public.deduct_wallet(p_user_id uuid, p_amount numeric)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
    v_wallet RECORD;
    v_new_balance NUMERIC;
BEGIN
    -- Lock the wallet row to prevent concurrent modifications
    SELECT id, balance, total_spent, credit_limit, unlimited_credit
    INTO v_wallet
    FROM wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Wallet not found'
        );
    END IF;

    -- Check sufficient balance (unless they have unlimited credit)
    -- Buying Power = Current Balance + Credit Limit
    IF NOT COALESCE(v_wallet.unlimited_credit, FALSE) AND (v_wallet.balance + COALESCE(v_wallet.credit_limit, 0)) < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'current_balance', v_wallet.balance,
            'credit_limit', v_wallet.credit_limit,
            'requested_amount', p_amount
        );
    END IF;

    -- Atomically deduct (balance can go negative)
    v_new_balance := v_wallet.balance - p_amount;

    UPDATE wallets
    SET balance = v_new_balance,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance
    );
END;
$$;

-- 3. Create deactivation function for automated daily settlement
-- This flags agents with negative balances for settlement.
CREATE OR REPLACE FUNCTION deactivate_agents_for_settlement()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Deactivate agents with negative balance (unless they have unlimited credit)
    UPDATE public.users
    SET requires_settlement = true
    FROM public.wallets
    WHERE users.id = wallets.user_id
      AND users.role = 'agent'
      AND wallets.balance < 0
      AND COALESCE(wallets.unlimited_credit, FALSE) = FALSE;
END;
$$;

-- 5. Add trigger to automatically reactive account when balance is cleared
CREATE OR REPLACE FUNCTION public.handle_wallet_settlement_reactivation()
RETURNS TRIGGER AS $$
BEGIN
    -- If balance is now zero or positive, clear the settlement flag
    IF NEW.balance >= 0 THEN
        UPDATE public.users 
        SET requires_settlement = FALSE 
        WHERE id = NEW.user_id AND requires_settlement = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_wallet_balance_settled ON public.wallets;
CREATE TRIGGER on_wallet_balance_settled
    AFTER UPDATE OF balance ON public.wallets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_wallet_settlement_reactivation();

-- One-time cleanup: Reactivate all agents who are currently settled (balance >= 0)
UPDATE public.users u
SET requires_settlement = FALSE
FROM public.wallets w
WHERE u.id = w.user_id
  AND u.requires_settlement = TRUE
  AND w.balance >= 0;

-- 6. Enable pg_cron and schedule daily deactivation at 10:30 PM (22:30)
-- NOTE: Requires pg_cron extension to be enabled in your Supabase Dashboard.
-- Go to Database -> Extensions and enable "pg_cron" first.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Safely remove existing schedule if any
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deactivate-agents-1030pm') THEN
        PERFORM cron.unschedule('deactivate-agents-1030pm');
    END IF;
END $$;

-- Schedule at 22:30 (10:30 PM) daily
SELECT cron.schedule('deactivate-agents-1030pm', '30 22 * * *', 'SELECT deactivate_agents_for_settlement()');
