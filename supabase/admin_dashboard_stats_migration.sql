-- ============================================================================
-- Admin Dashboard Stats — single-round-trip aggregate function
-- ----------------------------------------------------------------------------
-- Replaces the previous "fetch every order + every wallet, reduce in JS"
-- approach in /api/admin/stats with Postgres-side aggregation that scales.
--
-- Returns one JSONB payload with:
--   • headline counts + all-time revenue + wallet float
--   • today vs. yesterday deltas (revenue + orders)
--   • a 7-day revenue / profit / orders series (gap-filled)
--   • a 30-day network split (completed orders)
--   • the live pending/processing queue (latest 8)
--   • a recent-activity feed (latest 8 orders, any status)
--
-- SECURITY: SECURITY DEFINER so it can read across all rows, but it self-guards
-- by checking the *caller's* role via auth.uid(). Execute is granted only to
-- authenticated users; anon/public are revoked. Call it with the user's client
-- (the auth-helpers route client), NOT the service-role client, so auth.uid()
-- resolves to the signed-in admin.
--
-- Profit estimate mirrors /api/admin/profit-stats: cost falls back to 80% of
-- price when an order has no stored cost_price.
--
-- Run this in your Supabase SQL Editor.
-- Ghana operates at UTC±0, so date bucketing uses UTC (no tz conversion).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role     TEXT;
    v_today           DATE := (now() AT TIME ZONE 'UTC')::date;

    v_total_users     BIGINT;
    v_new_users_today BIGINT;

    v_total_orders    BIGINT;
    v_completed       BIGINT;
    v_pending         BIGINT;
    v_failed          BIGINT;
    v_total_revenue   NUMERIC;

    v_wallet_total    NUMERIC;

    v_today_orders        BIGINT;
    v_yesterday_orders    BIGINT;
    v_today_revenue       NUMERIC;
    v_yesterday_revenue   NUMERIC;
    v_today_profit        NUMERIC;

    v_series          JSONB;
    v_network         JSONB;
    v_pending_queue   JSONB;
    v_recent          JSONB;
BEGIN
    -- ---- Authorize: admins only -------------------------------------------
    SELECT role INTO v_caller_role FROM users WHERE id = auth.uid();
    IF v_caller_role IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Forbidden: admin access required';
    END IF;

    -- ---- Users -------------------------------------------------------------
    SELECT count(*) INTO v_total_users FROM users;
    SELECT count(*) INTO v_new_users_today
      FROM users WHERE created_at::date = v_today;

    -- ---- All-time order rollups -------------------------------------------
    SELECT
        count(*),
        count(*) FILTER (WHERE status = 'completed'),
        count(*) FILTER (WHERE status IN ('pending', 'processing')),
        count(*) FILTER (WHERE status = 'failed'),
        COALESCE(sum(price) FILTER (WHERE status = 'completed'), 0)
    INTO v_total_orders, v_completed, v_pending, v_failed, v_total_revenue
    FROM orders;

    -- ---- Wallet float (all wallets, matches legacy behaviour) -------------
    SELECT COALESCE(sum(balance), 0) INTO v_wallet_total FROM wallets;

    -- ---- Today vs. yesterday ----------------------------------------------
    SELECT
        count(*) FILTER (WHERE created_at::date = v_today),
        count(*) FILTER (WHERE created_at::date = v_today - 1),
        COALESCE(sum(price) FILTER (WHERE created_at::date = v_today     AND status = 'completed'), 0),
        COALESCE(sum(price) FILTER (WHERE created_at::date = v_today - 1 AND status = 'completed'), 0),
        COALESCE(sum(price - COALESCE(NULLIF(cost_price, 0), price * 0.8))
                 FILTER (WHERE created_at::date = v_today AND status = 'completed'), 0)
    INTO v_today_orders, v_yesterday_orders, v_today_revenue, v_yesterday_revenue, v_today_profit
    FROM orders;

    -- ---- 7-day series (gap-filled oldest -> newest) -----------------------
    SELECT COALESCE(jsonb_agg(
               jsonb_build_object(
                   'date',    day::text,
                   'revenue', rev,
                   'profit',  prof,
                   'orders',  ord
               ) ORDER BY day
           ), '[]'::jsonb)
    INTO v_series
    FROM (
        SELECT gs.day::date AS day,
               COALESCE(sum(o.price) FILTER (WHERE o.status = 'completed'), 0) AS rev,
               COALESCE(sum(o.price - COALESCE(NULLIF(o.cost_price, 0), o.price * 0.8))
                        FILTER (WHERE o.status = 'completed'), 0) AS prof,
               count(o.id) AS ord
        FROM generate_series(v_today - 6, v_today, interval '1 day') AS gs(day)
        LEFT JOIN orders o ON o.created_at::date = gs.day::date
        GROUP BY gs.day
    ) t;

    -- ---- 30-day network split (completed) ---------------------------------
    SELECT COALESCE(jsonb_agg(
               jsonb_build_object('network', network, 'orders', ord, 'revenue', rev)
               ORDER BY rev DESC
           ), '[]'::jsonb)
    INTO v_network
    FROM (
        SELECT network,
               count(*)              AS ord,
               COALESCE(sum(price),0) AS rev
        FROM orders
        WHERE status = 'completed'
          AND created_at >= (v_today - 29)
        GROUP BY network
    ) n;

    -- ---- Live pending / processing queue (latest 8) -----------------------
    SELECT COALESCE(jsonb_agg(row_to_json(p)::jsonb ORDER BY p.created_at DESC), '[]'::jsonb)
    INTO v_pending_queue
    FROM (
        SELECT id, network, size, phone_number, price, status, created_at
        FROM orders
        WHERE status IN ('pending', 'processing')
        ORDER BY created_at DESC
        LIMIT 8
    ) p;

    -- ---- Recent activity feed (latest 8, any status) ----------------------
    SELECT COALESCE(jsonb_agg(row_to_json(r)::jsonb ORDER BY r.created_at DESC), '[]'::jsonb)
    INTO v_recent
    FROM (
        SELECT id, network, size, phone_number, price, status, created_at
        FROM orders
        ORDER BY created_at DESC
        LIMIT 8
    ) r;

    -- ---- Assemble ----------------------------------------------------------
    RETURN jsonb_build_object(
        'totalUsers',         v_total_users,
        'newUsersToday',      v_new_users_today,
        'totalOrders',        v_total_orders,
        'completedOrders',    v_completed,
        'pendingOrders',      v_pending,
        'failedOrders',       v_failed,
        'totalRevenue',       v_total_revenue,
        'totalWalletBalance', v_wallet_total,
        'successRate',        CASE WHEN v_total_orders > 0
                                   THEN round((v_completed::numeric / v_total_orders) * 100)
                                   ELSE 0 END,
        'todayOrders',        v_today_orders,
        'yesterdayOrders',    v_yesterday_orders,
        'todayRevenue',       v_today_revenue,
        'yesterdayRevenue',   v_yesterday_revenue,
        'todayProfit',        v_today_profit,
        'revenueDeltaPct',    CASE WHEN v_yesterday_revenue > 0
                                   THEN round(((v_today_revenue - v_yesterday_revenue) / v_yesterday_revenue) * 100)
                                   WHEN v_today_revenue > 0 THEN 100 ELSE 0 END,
        'ordersDeltaPct',     CASE WHEN v_yesterday_orders > 0
                                   THEN round(((v_today_orders - v_yesterday_orders)::numeric / v_yesterday_orders) * 100)
                                   WHEN v_today_orders > 0 THEN 100 ELSE 0 END,
        'series',             v_series,
        'networkSplit',       v_network,
        'pendingQueue',       v_pending_queue,
        'recentActivity',     v_recent
    );
END;
$$;

-- Lock down execution: only signed-in users may call it; the function itself
-- enforces the admin check internally.
REVOKE ALL ON FUNCTION get_admin_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION get_admin_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION get_admin_dashboard_stats() TO authenticated;
