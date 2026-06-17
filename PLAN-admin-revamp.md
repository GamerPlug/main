# PLAN — Admin Revamp: Per-User Pricing + iShare Drop + Dead-Code Cleanup

**Protocol:** 5-Stage Workflow. No stage begins without explicit approval.
**Current stage:** Stage 2 (Planning) — awaiting approval to start Stage 3.
**Separate from** `PLAN.md` (in-progress Notifications/PWA effort — untouched).

| Stage | Name | Status |
|---|---|---|
| 1 | Exploration (Audit) | ✅ Complete |
| 2 | Planning | ✅ This document |
| 3 | Execution | ⏳ Awaiting approval |
| 4 | Security Audit | ⏳ Pending |
| 5 | QA & Push | ⏳ Pending |

---

## 0. Scope (confirmed with user)

1. **Feature:** Individual per-user, per-package custom pricing. Admin assigns a custom price to a specific user for specific package(s). That price is displayed to and charged to that user **regardless of role**, falling back to role/base price where no override exists. UI lives on the Packages page behind a tab.
2. **Drop AT-iShare entirely** (network + fulfillment + services + admin pages + toggle). Keep AT-BigTime, MTN, Telecel.
3. **Delete pages:** `ishare-logs`, `payment-status`, and the 4 orphaned admin pages (`afa-management`, `mtn-logs`, `transactions`, `memberships`).
4. **Remove dead endpoints:** legacy agent-tier (`user/upgrade/initialize`, `agent/downgrade`, `admin/extend-agent`, `admin/agents`), `admin/update-prices`, web `orders/purchase`, plus `admin/ishare/fulfill`.
5. **Confirm all remaining admin pages work** (Stage 5 verification).

**Untouched (confirmed live):** Paystack (`webhooks/paystack`, `payments/*`), all `v1/*` public API, all crons, `sync-codecraft-status` (Telecel may depend on CodeCraft).

---

## 1. Database migration — `supabase/user_package_pricing_migration.sql`
Idempotent, matches existing migration style.

```sql
CREATE TABLE IF NOT EXISTS public.user_package_pricing (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    package_id uuid NOT NULL REFERENCES public.data_packages(id) ON DELETE CASCADE,
    custom_price numeric NOT NULL CHECK (custom_price >= 0),
    note text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (user_id, package_id)
);
CREATE INDEX IF NOT EXISTS idx_upp_user ON public.user_package_pricing(user_id);

ALTER TABLE public.user_package_pricing ENABLE ROW LEVEL SECURITY;

-- Users may read ONLY their own overrides (needed for client price display).
CREATE POLICY "Users read own pricing" ON public.user_package_pricing
    FOR SELECT USING (auth.uid() = user_id);

-- All writes go through service-role (admin API). No anon/authenticated write policy.
```

**iShare data:** disable, don't hard-delete, existing rows:
```sql
UPDATE public.data_packages SET is_available = false WHERE network = 'AT-iShare';
```
(Keeps historical orders/FKs intact; hides them from purchase.)

---

## 2. Types — `types/supabase.ts`
- Remove `'AT-iShare'` from the `DataPackage.network` union → `'MTN' | 'Telecel' | 'AT-BigTime'`.
- Add `UserPackagePricing` interface.

---

## 3. Shared price resolver — `lib/pricing.ts` (NEW — single source of truth)
Eliminates the 6× duplicated role→price logic and adds override support.

```ts
// Pure resolution: override > role > base
export function resolvePackagePrice(
  pkg: { id; price; dealer_price?; agent_price? },
  role: string,
  overrides?: Map<string, number>   // packageId -> custom_price
): number

// Server-side batch fetch (service-role): userId + optional packageIds -> Map
export async function getUserPriceOverrides(
  supabase, userId, packageIds?
): Promise<Map<string, number>>
```

Wire into all resolution points:
| File | Change |
|---|---|
| `app/api/orders/create-bulk/route.ts` | fetch overrides once for user, resolve per item |
| `app/api/v1/orders/purchase/route.ts` | resolve single |
| `app/api/v1/orders/bulk/route.ts` | fetch overrides, resolve per item |
| `app/api/v1/packages/route.ts` | fetch overrides for `context.userId`, map prices |
| `app/dashboard/data-packages/page.tsx` | client reads own overrides via supabase (RLS own-row), apply in price display |
| `app/api/orders/purchase/route.ts` | **DELETED** (see §6) — no longer a resolution point |

**Invariant:** price is always resolved server-side from DB before wallet deduction. Client price is display-only.

---

## 4. Admin Custom-Pricing UI + API

**API — `app/api/admin/user-pricing/route.ts`** (admin-guarded, service-role, mirrors `admin/packages`):
- `GET` → list overrides joined with user (name/email/role) + package (network/size/role prices). Supports `?userId=`/search.
- `POST` `{ userId, packageId, customPrice, note? }` → upsert on `(user_id, package_id)`; set `created_by`.
- `DELETE ?id=` → remove an override.

**UI — `app/admin/packages/page.tsx`** → wrap content in `Tabs`:
- **Tab "Packages"** — existing grid (unchanged behavior).
- **Tab "Custom Pricing"**:
  - Table: User · Role · Network/Size · Role price (for reference) · Custom price · Remove.
  - "Assign Pricing" dialog: user search (reuse `/api/admin/users?search=`), package select (from loaded packages), price input, optional note → POST. Validate `customPrice > 0`.
  - Realtime/refetch on change; toast feedback.

---

## 5. Drop AT-iShare — file-by-file
| File | Change |
|---|---|
| `app/admin/ishare-logs/page.tsx` | **delete** dir |
| `app/admin/payment-status/page.tsx` | **delete** dir |
| `app/api/admin/ishare/fulfill/route.ts` | **delete** dir |
| `lib/ishare-fulfillment.ts`, `lib/spfastit-service.ts` | **delete** (SPFastIT iShare only) |
| `lib/at-ishare-service.ts` | **KEEP** — execution found this is the **CodeCraft** service still used by Telecel/AT-BigTime (Paystack webhook, guest verify, codecraft cron). Only removed its `AT-iShare` mapping + header comment. |
| `app/api/webhooks/paystack/route.ts` | **(deviation)** removed the AT-iShare `fulfillIShareOrderWithTracking` branch + import (this route is kept) |
| `app/api/orders/create-bulk`, `v1/orders/purchase`, `v1/orders/bulk` | remove `triggerFulfillment` AT-iShare branch + `fulfillIShareOrderWithTracking` import |
| `app/admin/orders/page.tsx`, `app/dashboard/my-orders/page.tsx` | drop `AT-iShare` from network filters + the iShare auto-fulfill hide logic |
| `app/admin/packages/page.tsx` | `NETWORKS` → drop `'AT-iShare'`; color map cleanup |
| `app/dashboard/data-packages/page.tsx`, `app/guest/purchase/page.tsx` | drop `'AT-iShare'` from any network lists |
| `components/network-icon.tsx` | remove AT-iShare icon branch |
| `components/dashboard/sidebar.tsx` | remove `ishare-logs` + `payment-status` nav items (+ unused `Zap`/`CreditCard` imports) |
| `types/supabase.ts` | network union (§2) |

Grep-gate after edits: zero remaining `ishare|iShare|spfastit|AT-iShare` references outside SQL history/README.

---

## 6. Remove dead endpoints (confirmed no callers)
**Delete dirs:** `app/api/user/upgrade/initialize`, `app/api/agent/downgrade`, `app/api/admin/extend-agent`, `app/api/admin/agents`, `app/api/admin/update-prices`, `app/api/orders/purchase`.
**Delete orphan pages:** `app/admin/afa-management`, `app/admin/mtn-logs`, `app/admin/transactions`, `app/admin/memberships`.
For each: final grep to confirm no inbound reference before deletion; if any appears, halt and report instead of deleting.

---

## 7. Files summary
**New:** `supabase/user_package_pricing_migration.sql`, `lib/pricing.ts`, `app/api/admin/user-pricing/route.ts`.
**Modified:** `app/admin/packages/page.tsx`, `app/dashboard/data-packages/page.tsx`, `app/guest/purchase/page.tsx`, `app/api/orders/create-bulk/route.ts`, `app/api/v1/orders/purchase/route.ts`, `app/api/v1/orders/bulk/route.ts`, `app/api/v1/packages/route.ts`, `components/dashboard/sidebar.tsx`, `components/network-icon.tsx`, `types/supabase.ts`.
**Deleted:** 3 libs + 6 API routes + 6 admin pages (see §5–6).

---

## 8. Security checklist (Stage 4)
- `user_package_pricing`: RLS = SELECT own-row only; **no** client write path; admin API uses service-role + admin guard (role check) like `admin/packages`.
- Price always resolved server-side from DB pre-deduction; override `>= 0` enforced by CHECK; admin form requires `> 0`.
- Admin user-pricing API validates `userId`/`packageId` are UUIDs; rejects non-admin.
- Deleting AT-iShare packages avoided (set unavailable) → no FK breakage on historical orders.
- Confirm removed endpoints aren't referenced by middleware, vercel.json, or external docs.

## 9. QA checklist (Stage 5)
- `tsc --noEmit`, `next lint`, `next build` all clean.
- Manual: assign custom price → that user sees & is charged it (web single, web bulk, v1 API); other roles unaffected; remove override → reverts to role price.
- Every remaining admin page loads + core action works: dashboard, orders, users, packages (both tabs), complaints, announcements, sms-broadcast, profits-history, api-management, settings.
- Grep gate: no `ishare`/iShare residue; no references to deleted endpoints.

## 10. Execution order (Stage 3)
1. Migration + types → 2. `lib/pricing.ts` → 3. wire resolver into order routes + v1 + client → 4. admin user-pricing API → 5. packages page tabs + custom-pricing UI → 6. drop AT-iShare across files → 7. delete dead endpoints + orphan pages → 8. grep gate + build.

## 11. Risks / open items
- Removing web `orders/purchase`: low risk (frontend uses `create-bulk`), but it's the canonical single-order route — confirm no external/mobile client depends on it.
- AFA/MTN-log admin viewers disappear (data flows unaffected); revisit if admin still needs visibility.
- Crons not in `vercel.json` are assumed externally scheduled — left untouched.
