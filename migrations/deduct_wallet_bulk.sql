-- Atomic wallet deduction function
-- Prevents race conditions and double-spending by using row-level locking
-- Run this in your Supabase SQL Editor

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
    -- Lock the wallet row to prevent concurrent modifications
    SELECT id, balance, total_spent
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

    -- Check sufficient balance
    IF v_wallet.balance < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'current_balance', v_wallet.balance,
            'requested_amount', p_amount
        );
    END IF;

    -- Atomically deduct
    v_new_balance := v_wallet.balance - p_amount;

    UPDATE wallets
    SET balance = v_new_balance,
        total_spent = COALESCE(total_spent, 0) + p_amount,
        updated_at = NOW()
    WHERE id = v_wallet.id;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'wallet_id', v_wallet.id,
        'deducted_amount', p_amount
    );
END;
$$;

-- Also create a refund function for partial bulk order failures
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
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Wallet not found'
        );
    END IF;

    v_new_balance := v_wallet.balance + p_amount;

    UPDATE wallets
    SET balance = v_new_balance,
        total_spent = GREATEST(COALESCE(total_spent, 0) - p_amount, 0),
        updated_at = NOW()
    WHERE id = v_wallet.id;

    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'wallet_id', v_wallet.id,
        'refunded_amount', p_amount
    );
END;
$$;
