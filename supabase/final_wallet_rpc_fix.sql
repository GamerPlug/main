ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS credit_limit DECIMAL DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS unlimited_credit BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.deduct_wallet(p_user_id uuid, p_amount numeric)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_wallet RECORD;
    v_new_balance NUMERIC;
BEGIN
    SELECT id, balance, total_spent, credit_limit, unlimited_credit INTO v_wallet
    FROM wallets WHERE user_id = p_user_id FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Wallet not found'); END IF;

    IF NOT COALESCE(v_wallet.unlimited_credit, FALSE) AND (v_wallet.balance + COALESCE(v_wallet.credit_limit, 0)) < p_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    v_new_balance := v_wallet.balance - p_amount;
    UPDATE wallets SET balance = v_new_balance, total_spent = COALESCE(total_spent, 0) + p_amount, updated_at = NOW() WHERE id = v_wallet.id;
    RETURN jsonb_build_object('success', true, 'new_balance', v_new_balance, 'wallet_id', v_wallet.id);
END;
$$;
