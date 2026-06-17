-- ============================================================
-- FIX FOREIGN KEY CONSTRAINTS MIGRATION
-- Run this in the Supabase SQL Editor to resolve issues where
-- deleting records (like data packages or users) fails due to
-- missing ON DELETE clauses.
-- ============================================================

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
    ) LOOP

        -- orders -> data_packages
        IF r.table_name = 'orders' AND r.column_name = 'package_id' AND r.foreign_table_name = 'data_packages' THEN
            EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.orders ADD CONSTRAINT orders_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.data_packages(id) ON DELETE SET NULL';
        END IF;
        
        -- orders -> users
        IF r.table_name = 'orders' AND r.column_name = 'user_id' AND r.foreign_table_name = 'users' THEN
            EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL';
        END IF;

        -- orders -> download_batches
        IF r.table_name = 'orders' AND r.column_name = 'download_batch_id' AND r.foreign_table_name = 'download_batches' THEN
            EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.orders ADD CONSTRAINT orders_download_batch_id_fkey FOREIGN KEY (download_batch_id) REFERENCES public.download_batches(id) ON DELETE SET NULL';
        END IF;

        -- wallet_payments -> wallets
        IF r.table_name = 'wallet_payments' AND r.column_name = 'wallet_id' AND r.foreign_table_name = 'wallets' THEN
            EXECUTE 'ALTER TABLE public.wallet_payments DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.wallet_payments ADD CONSTRAINT wallet_payments_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE SET NULL';
        END IF;

        -- wallet_payments -> users
        IF r.table_name = 'wallet_payments' AND r.column_name = 'user_id' AND r.foreign_table_name = 'users' THEN
            EXECUTE 'ALTER TABLE public.wallet_payments DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.wallet_payments ADD CONSTRAINT wallet_payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL';
        END IF;

        -- wallet_transactions -> wallets
        IF r.table_name = 'wallet_transactions' AND r.column_name = 'wallet_id' AND r.foreign_table_name = 'wallets' THEN
            EXECUTE 'ALTER TABLE public.wallet_transactions DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_wallet_id_fkey FOREIGN KEY (wallet_id) REFERENCES public.wallets(id) ON DELETE SET NULL';
        END IF;

        -- wallet_transactions -> users
        IF r.table_name = 'wallet_transactions' AND r.column_name = 'user_id' AND r.foreign_table_name = 'users' THEN
            EXECUTE 'ALTER TABLE public.wallet_transactions DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL';
        END IF;

        -- notifications -> users
        IF r.table_name = 'notifications' AND r.column_name = 'user_id' AND r.foreign_table_name = 'users' THEN
            EXECUTE 'ALTER TABLE public.notifications DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE';
        END IF;

        -- download_batches -> auth.users (ccu.table_name may be 'users' for auth.users in some pg versions, but we match column name)
        IF r.table_name = 'download_batches' AND r.column_name = 'created_by' THEN
            EXECUTE 'ALTER TABLE public.download_batches DROP CONSTRAINT ' || r.constraint_name;
            EXECUTE 'ALTER TABLE public.download_batches ADD CONSTRAINT download_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL';
        END IF;

    END LOOP;
END $$;
