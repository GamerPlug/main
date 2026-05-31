-- 1. Add dealer_price to data_packages
ALTER TABLE public.data_packages 
ADD COLUMN IF NOT EXISTS dealer_price NUMERIC DEFAULT 0;

-- 2. Update user_role_check constraint to include 'dealer'
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
    CHECK (role IN ('admin', 'sub-admin', 'dealer', 'agent', 'customer', 'user'));
END $$;

-- 3. Update existing agent_upgrade_price setting (optional, but good for consistency)
INSERT INTO public.admin_settings (key, value) VALUES ('dealer_upgrade_price', '150') ON CONFLICT (key) DO NOTHING;
