-- 1. Add new pricing columns to data_packages
ALTER TABLE public.data_packages 
ADD COLUMN IF NOT EXISTS super_agent_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS super_dealer_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS platinum_price NUMERIC DEFAULT 0;

-- 2. Update user_role_check constraint in users table
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
    CHECK (role IN ('admin', 'sub-admin', 'super dealer', 'dealer', 'super agent', 'agent', 'platinum', 'customer', 'user'));
END $$;

-- 3. (Optional) Add default upgrade prices to admin_settings
INSERT INTO public.admin_settings (key, value) VALUES ('super_agent_upgrade_price', '50') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.admin_settings (key, value) VALUES ('super_dealer_upgrade_price', '250') ON CONFLICT (key) DO NOTHING;
INSERT INTO public.admin_settings (key, value) VALUES ('platinum_upgrade_price', '500') ON CONFLICT (key) DO NOTHING;
