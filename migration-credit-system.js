const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  host: 'db.fxldvqfzxgwhuzshazff.supabase.co',
  database: 'postgres',
  password: 'Oforibenedict419@',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

async function run() {
  try {
    await client.connect();
    console.log('Connected to target database.');

    // 1. Add credit_limit to wallets
    await client.query('ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS credit_limit DECIMAL DEFAULT 0.00;');
    console.log('Added credit_limit column.');

    // 2. Update deduct_wallet RPC
    const deductWalletSql = `
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
    SELECT id, balance, total_spent, credit_limit
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

    -- Check sufficient balance (including credit limit)
    IF (v_wallet.balance + COALESCE(v_wallet.credit_limit, 0)) < p_amount THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'current_balance', v_wallet.balance,
            'credit_limit', v_wallet.credit_limit,
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
        'new_balance', v_new_balance
    );
END;
$$;
    `;
    await client.query(deductWalletSql);
    console.log('Updated deduct_wallet RPC.');

    // 3. Create deactivation function
    const deactivateSql = `
CREATE OR REPLACE FUNCTION deactivate_agents_for_settlement()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Deactivate agents with negative balance
    UPDATE public.users
    SET requires_settlement = true
    FROM public.wallets
    WHERE users.id = wallets.user_id
      AND users.role = 'agent'
      AND wallets.balance < 0;
END;
$$;
    `;
    await client.query(deactivateSql);
    console.log('Created deactivated_agents_for_settlement function.');

    // 4. pg_cron schedule
    try {
        await client.query('CREATE EXTENSION IF NOT EXISTS pg_cron;');
        await client.query("SELECT cron.schedule('deactivate-agents-1030pm', '30 22 * * *', 'SELECT deactivate_agents_for_settlement()');");
        console.log('Scheduled daily deactivation at 10:30 PM.');
    } catch (err) {
        console.warn('Could not schedule with pg_cron (might lack permissions):', err.message);
        console.log('You may need to enable pg_cron in the Supabase Dashboard and run the schedule command manually.');
    }

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

run();
