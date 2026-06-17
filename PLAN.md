# PLAN — Modern Notifications + Web Push + Installable PWA

**Protocol:** 5-Stage Workflow. No stage begins without explicit approval.
**Current stage:** Stage 2 (Planning) — awaiting approval to start Stage 3.
**Mode:** All-in-one build (single Security + QA pass at the end).
**SW strategy:** Hand-rolled minimal service worker (only new dependency: server-side `web-push`).
**New-notification scope:** Money · Account & security · Admin broadcast · Marketing/engagement · Order lifecycle.

| Stage | Name | Status |
|---|---|---|
| 1 | Exploration (Audit) | ✅ Complete |
| 2 | Planning | ✅ This document |
| 3 | Execution | ⏳ Awaiting approval |
| 4 | Security Audit | ⏳ Pending |
| 5 | QA & Push | ⏳ Pending |

---

## 0. Audit summary (Stage 1) — what we are fixing

| # | Finding | Severity | Fix |
|---|---------|----------|-----|
| B1 | No DELETE RLS policy → user "Delete"/"Delete All" silently no-ops, rows reappear on refresh | High | Add user DELETE policy |
| B2 | Cleanup cron deletes **all** notifications >24h incl. unread → users lose unseen alerts | High | Read >7d, unread >30d |
| B3 | Header bell badge fetched once, no realtime → stale until reload | Medium | Realtime + dropdown |
| B4 | `paymentSuccessNotification`, `complaintResolvedNotification`, `balanceUpdatedNotification` are dead code | Medium | Replace w/ central service |
| B5 | User self top-up (`payments/verify`) creates **no** in-app notification | Medium | Wire payment_success + balance_credited |
| B6 | `system_announcements`: admins post, **no user ever sees them** (zero consumers) | High | Fan out → notifications + push |
| B7 | `type` is free-text; page `getIcon` handles only 4 types | Low | Standardize taxonomy |

---

## 1. Database migration — `supabase/notifications_pwa_migration.sql`
One idempotent file (CREATE/ADD/DROP POLICY IF NOT EXISTS), matching existing migration style.

**1a. `notifications` upgrades**
- `read_at TIMESTAMPTZ`, `metadata JSONB DEFAULT '{}'`, `priority TEXT DEFAULT 'normal'` (`low|normal|high`)
- Index `idx_notifications_user_unread (user_id, is_read, created_at DESC)`
- **RLS fix B1:** `FOR DELETE USING (auth.uid() = user_id)`

**1b. `push_subscriptions`** — `id, user_id fk, endpoint unique, p256dh, auth, user_agent, created_at, last_used_at`; RLS own + service ALL; index `user_id`.

**1c. `notification_preferences`** — `user_id pk fk, order_updates, payments, security, announcements (default true), marketing (default false), push_enabled (default true), updated_at`; RLS own + service; lazily upserted.

**1d. `system_announcements`** — add `target_role TEXT DEFAULT 'all'` (`all|admin|dealer|agent`), `send_push BOOLEAN DEFAULT true`.

---

## 2. Types — `types/supabase.ts`
- Expand `NotificationType` to full taxonomy (§3).
- Add `PushSubscription`, `NotificationPreferences`; extend `Notification` (`read_at?`, `metadata?`, `priority?`) and `SystemAnnouncement` (`target_role`, `send_push`).
- Register new tables in the `Database` generic.

---

## 3. Taxonomy (single source of truth)
`order_placed · order_processing · order_completed · order_failed · payment_success · refund_issued · balance_credited · balance_debited · low_balance · credit_limit_reached · settlement_due · complaint_received · complaint_resolved · complaint_rejected · account_suspended · account_reactivated · role_upgraded · role_downgraded · security_new_login · security_password_changed · api_key_created · api_key_revoked · announcement · promo · new_package · price_drop · renewal_reminder · system`

Each maps to `{ category, icon, priority, defaultActionUrl }` for consistent UI + preference gating.

---

## 4. Service layer — rewrite `lib/notification-service.ts`
- `createNotification(data)` → insert row, **then** best-effort `sendPushToUser` (never throws into caller).
- Gates on `notification_preferences` (category) + `push_enabled` before pushing.
- `createBulkNotifications(userIds[], data)` → chunked insert + chunked push (broadcast).
- Idempotency via `metadata.dedupe_key` (e.g. `order_completed:<order_id>`) — skip if exists (stops duplicate alerts from re-running crons).
- `notificationTemplates` factory covering every type in §3.

---

## 5. Web Push — `lib/web-push.ts` + API
- Dep: `web-push` (+ `@types/web-push` dev).
- Env (add to `.env.example`): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- `lib/web-push.ts`: lazy VAPID config; `sendPushToUser` / `sendPushToMany`; prune subs on 404/410.
- `POST /api/push/subscribe` — auth required; `user_id` from session (never body); upsert by endpoint; rate-limited.
- `POST /api/push/unsubscribe` — remove endpoint for current user.

---

## 6. Service worker + client (hand-rolled)
- `public/sw.js`: `install/activate` (precache shell + `/offline`, skipWaiting/clients.claim); `push` → `showNotification`; `notificationclick` → focus/open `data.url`; `fetch` → network-first navigations w/ `/offline` fallback. **No caching of API/auth responses.**
- `hooks/use-push-notifications.ts`: register SW, request permission, subscribe w/ VAPID, POST subscribe; returns `{ permission, isSubscribed, subscribe, unsubscribe, isSupported }`.
- `components/pwa/sw-register.tsx`: registers SW; mounted in `app/layout.tsx`.

---

## 7. PWA / Installable
- `app/manifest.ts`: name/short_name, `display: standalone`, `start_url:/dashboard`, `scope:/`, brand colors, icons (192, 512, 512-maskable).
- `public/icons/*` from `logo.png`: 192, 512, maskable-512, apple-touch-180 (generate via temp `sharp`; fallback hand-padded).
- `app/layout.tsx`: Apple meta tags, `apple-touch-icon`, manifest link, brand `themeColor`.
- `components/pwa/install-prompt.tsx`: `beforeinstallprompt` banner (Android/desktop) + iOS A2HS instructions modal; triggers in sidebar footer + header.
- `app/offline/page.tsx`: branded offline screen.
- iOS note in copy: web push requires installed PWA (iOS 16.4+).

---

## 8. UI modernization
- **Header bell**: realtime subscription, dropdown preview (latest 5 + mark-all + "See all"), live badge (fixes B3).
- **Notifications page**: date grouping, category filter chips, mark-read-on-click, pagination/infinite scroll, push opt-in card, preferences link. Delete works post-B1.
- **Foreground toast** on realtime insert (Sonner).
- **Preferences page** `app/dashboard/notifications/preferences/page.tsx`: per-category toggles, master push toggle, permission state, "Send test notification".
- **Admin announcements** (`app/admin/announcements/page.tsx`): add target_role select + "send push" toggle; on create call `POST /api/admin/announcements/broadcast` (fan out + push) — fixes B6.

---

## 9. Wire the gaps (route-by-route)
| Route / file | Add |
|---|---|
| `app/api/payments/verify/route.ts` | `payment_success` + `balance_credited` (B5) |
| `app/api/admin/users/wallet/adjustment/route.ts` | inline insert → central service + push |
| `app/api/admin/complaints/resolve/route.ts` | inline insert → central service + push |
| `orders/purchase`, `create-bulk`, `v1/orders/purchase` | `order_placed` + push (standardize) |
| `lib/ishare-fulfillment.ts`, `cron/sync-mtn-status`, `cron/sync-codecraft-status` | `order_completed/failed` via service + push + dedupe |
| `admin/orders/refund`, `admin/orders/status` | `refund_issued` / status + push |
| `admin/users/role` | `role_upgraded` / `role_downgraded` |
| `admin/users/update-status`, `settle-reactivate` | `account_suspended` / `account_reactivated` / `settlement_due` |
| `app/api/user/api-keys` | `api_key_created` / `api_key_revoked` |
| `cron/agent-renewal-reminder` | in-app `renewal_reminder` alongside email |
| (optional) `cron/low-balance-check` | proactive `low_balance` |

---

## 10. Cleanup cron fix (B2)
`cron/delete-old-notifications` + `cleanupOldNotifications`: delete **read** >7d AND **unread** >30d (keeps unseen alerts).

---

## 11. Files
**New:** `supabase/notifications_pwa_migration.sql`, `lib/web-push.ts`, `app/api/push/subscribe/route.ts`, `app/api/push/unsubscribe/route.ts`, `app/api/admin/announcements/broadcast/route.ts`, `public/sw.js`, `public/icons/*`, `app/manifest.ts`, `app/offline/page.tsx`, `hooks/use-push-notifications.ts`, `components/pwa/sw-register.tsx`, `components/pwa/install-prompt.tsx`, `app/dashboard/notifications/preferences/page.tsx`.
**Modified:** `lib/notification-service.ts`, `types/supabase.ts`, `app/layout.tsx`, `components/dashboard/header.tsx`, `components/dashboard/sidebar.tsx`, `app/dashboard/notifications/page.tsx`, `app/admin/announcements/page.tsx`, `app/api/cron/delete-old-notifications/route.ts`, `.env.example`, + ~10 wiring routes (§9).

---

## 12. Security checklist (Stage 4)
- `subscribe` binds `user_id` from session, never body; rate-limited.
- Broadcast route `requireAdmin`; chunked; respects target_role.
- New tables RLS = own-row only; service role for fan-out.
- VAPID private key server-only; only public key is `NEXT_PUBLIC_`.
- SW caches no authenticated/API responses (no stale wallet/order data).
- CSP: SW + manifest same-origin (covered by `default-src 'self'`) — confirm no change.

## 13. QA checklist (Stage 5)
- `tsc --noEmit`, `next lint`, `next build`.
- Manifest installability (Lighthouse); install on Android Chrome + desktop; iOS A2HS documented.
- Push end-to-end (Android/desktop): permission → subscribe → receive → click → route.
- Realtime bell + toast; delete/mark-read post-RLS; cron dry-run.

---

## 14. Execution order (Stage 3)
1. DB migration + types → 2. notification-service + taxonomy → 3. web-push lib + subscribe/unsubscribe → 4. SW + manifest + icons + register + layout meta → 5. push hook + install prompt + offline → 6. header/page/preferences UI → 7. announcements broadcast + admin UI → 8. wire gap routes + cron fix.

## 15. Risks / open items
- Icon generation needs temp `sharp` or manual assets — confirm at execution.
- VAPID keys must be generated (`npx web-push generate-vapid-keys`) + added to env before push works.
- iOS push requires installed PWA (documented in UI).
- Large broadcasts chunked to respect Vercel function limits.
