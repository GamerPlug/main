# PLAN — Security Hardening: Auth-Only Migration

**Protocol:** 5-Stage Workflow. **Current stage:** 3 (Execution) — approved.
Driven by the red-team audit. Goal: remove the guest feature, make the platform
**authenticated-only**, and harden auth / race conditions / RLS / payments, and
remove dead endpoints.

## 1. Critical secret exposure (manual + code)
- `git rm --cached .env.local.bak` (stop tracking; `.gitignore` already lists it).
- **User must:** rotate Supabase `service_role` key + DB password (DATABASE_URL),
  revoke the GitHub PAT embedded in the `origin` remote URL, and purge
  `.env.local.bak` from git history (filter-repo/BFG + force-push). History
  rewrite/force-push is destructive & outward-facing → left to the user.

## 2. Remove guest feature (auth-only platform)
Delete: `app/api/guest/**`, `app/guest/**`.
Edit: webhook (drop `GST-` branch + helpers), `mobile-menu.tsx` (remove link),
`app/admin/settings/page.tsx` (remove `guestPurchaseEnabled`),
`admin/orders/status` (comments only).

## 3. Remove dead/unused endpoints (evidence-based)
- `app/api/admin/get-prices/route.ts` + `lib/pricing-cache.ts` (no consumers).
- `app/api/admin/maintenance/fix-batches/route.ts` (no caller).
- KEPT external contracts: `v1/**`, `webhooks/paystack`, `cron/**`.

## 4. Authentication hardening (HIGH)
- Add `requireUser()` to `lib/admin-auth.ts` (server-verified `getUser()`).
- Migrate every protected route `getSession()` → `requireUser()`/`requireAdmin()`.
- `middleware.ts`: `getSession()` → `getUser()`.
- `payments/verify` + `webhooks/paystack` stay reference/HMAC based.

## 5. Race-condition + RLS migration (`auth_only_hardening_migration.sql`)
- `adjust_wallet_balance(p_user_id, p_amount, p_type)` SECURITY DEFINER, FOR UPDATE,
  service_role only (fixes admin wallet TOCTOU).
- Drop guest RPCs + `guest_purchase_enabled` setting (closes phone enumeration).
- Re-assert orders/users RLS.

## 6. Payment hardening
- `payments/verify`: verify amount == total_amount*100 and currency GHS.

## 7. Remaining findings
- M3 complaint IDOR (ownership + UUID), M5 v1 bulk idempotency, L2 batches search
  sanitize, L4 cron constant-time secret, L7 api-management explicit columns,
  role allowlist.

## 8. QA (Stage 5)
- `tsc --noEmit` + lint. Deliver SQL migration + manual rotation checklist.
