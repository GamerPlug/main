-- ============================================================
-- USER PACKAGE PRICING MIGRATION
-- Per-user, per-package custom price overrides.
-- Run in the Supabase SQL Editor. Safe to re-run (idempotent guards).
--
-- Model: admin assigns a custom price to a specific user for a
-- specific package. That price is charged to that user regardless
-- of role, falling back to role/base price where no override exists.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_package_pricing (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    package_id   uuid NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
    custom_price numeric NOT NULL CHECK (custom_price > 0),
    note         text,
    created_by   uuid REFERENCES public.users(id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, package_id)
);

CREATE INDEX IF NOT EXISTS idx_upp_user ON public.user_package_pricing(user_id);
CREATE INDEX IF NOT EXISTS idx_upp_package ON public.user_package_pricing(package_id);

-- ------------------------------------------------------------
-- RLS: users may read ONLY their own overrides (needed so the
-- dashboard can display the correct price). All writes happen
-- server-side via the admin API (service_role), so there is no
-- INSERT/UPDATE/DELETE policy for anon/authenticated.
-- ------------------------------------------------------------
ALTER TABLE public.user_package_pricing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own pricing" ON public.user_package_pricing;
CREATE POLICY "Users read own pricing" ON public.user_package_pricing
    FOR SELECT
    USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- keep updated_at fresh on upsert/update
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_user_package_pricing_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_upp_updated_at ON public.user_package_pricing;
CREATE TRIGGER trg_upp_updated_at
    BEFORE UPDATE ON public.user_package_pricing
    FOR EACH ROW EXECUTE FUNCTION public.touch_user_package_pricing_updated_at();

-- ============================================================
-- DROP AT-iShare: disable (do NOT delete) existing rows so that
-- historical orders / FKs remain intact, but the packages no
-- longer appear for purchase.
-- ============================================================
UPDATE public.data_packages
SET is_available = false
WHERE network = 'AT-iShare';

-- ============================================================
-- DONE.
-- ============================================================
