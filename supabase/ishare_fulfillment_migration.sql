-- iShare Auto-Fulfillment Migration
-- Creates logs table for SPFastIT API fulfillment attempts and seeds the setting

CREATE TABLE IF NOT EXISTS public.ishare_fulfillment_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'processing',  -- processing | success | failed
    bundle_mb INTEGER,
    phone_number TEXT,
    api_response JSONB,
    error_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ishare_logs_order_id ON public.ishare_fulfillment_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_ishare_logs_status ON public.ishare_fulfillment_logs(status);
CREATE INDEX IF NOT EXISTS idx_ishare_logs_created_at ON public.ishare_fulfillment_logs(created_at);

ALTER TABLE public.ishare_fulfillment_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ishare_fulfillment_logs"
    ON public.ishare_fulfillment_logs
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Seed the auto-fulfillment setting (default OFF — admin enables when ready)
INSERT INTO public.admin_settings (key, value)
VALUES ('ishare_auto_fulfillment_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
