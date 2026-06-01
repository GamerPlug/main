# GAMER PLUG SOLUTION — Rebranding & UI Build Plan

**Protocol:** 5-Stage Workflow. No stage begins without explicit approval.  
**Current stage:** Stage 2 → Stage 3 (approved 2026-06-01)

---

## Stage Status

| Stage | Name | Status |
|---|---|---|
| 1 | Exploration (Audit) | ✅ Complete |
| 2 | Planning | ✅ Complete — this document |
| 3 | Execution | 🔄 In Progress |
| 4 | Security Audit | ⏳ Pending |
| 5 | QA & Push | ⏳ Pending |

---

## Phase 1 — Database Fix (Blocking — must run before first login)

> File: `supabase/clone_database.sql`

### Fix 1.1 — Role constraint (CRITICAL)
**Problem:** Constraint only allows 5 roles. App defines 8.  
**Fix:** Expand to include all roles from `lib/roles.ts`.
```sql
CHECK (role IN ('admin', 'sub-admin', 'platinum', 'super dealer', 'dealer', 'super agent', 'agent', 'user'))
```

### Fix 1.2 — Default role on sign-up (CRITICAL)
**Problem:** `handle_new_user` trigger defaults new users to `'customer'` — an unknown role.  
**Fix:** Change default to `'user'`.
```sql
COALESCE(new.raw_user_meta_data->>'role', 'user')
```

### Fix 1.3 — Missing wallet columns (CRITICAL)
**Problem:** `auth-context.tsx` selects `credit_limit` and `unlimited_credit` from wallets — columns don't exist.  
**Fix:** Add columns to wallets table definition.
```sql
credit_limit   DECIMAL(12,2) DEFAULT 0,
unlimited_credit BOOLEAN DEFAULT false,
```

### Fix 1.4 — Missing tables
**Problem:** Admin pages exist in the app with no backing tables.

| Admin Page | Missing Table |
|---|---|
| `app/admin/api-management/` | `api_keys` |
| `app/admin/memberships/` | `memberships` |
| `app/admin/mtn-logs/` | `mtn_logs` |
| `app/admin/ishare-logs/` | `ishare_logs` |
| `app/admin/profits-history/` | `profits_history` |

### Fix 1.5 — Default settings update
- Change `support_email` from `support@mdatagh.com` to `support@gamerplug.com`
- Add missing keys: `support_whatsapp`, `whatsapp_group_link`, `whatsapp_channel_link`
- Fix final comment from "MDataGH" to "GAMER PLUG SOLUTION"

---

## Phase 2 — Brand Rename (3 remaining files)

### Fix 2.1 — `app/admin/orders/page.tsx`
Replace 3 occurrences of `EASYDATA_` with `GAMERPLUG_` in export filenames:
- Line 469: fallback filename
- Line 655: export prefix
- Line 776: filename check condition

### Fix 2.2 — `app/admin/settings/page.tsx`
- Line 149: `"EASYDATA Settings"` → `"GAMER PLUG Settings"`
- Line 179: placeholder `"support@EASYDATA.com"` → `"support@gamerplug.com"`

### Fix 2.3 — `lib/email-service.ts`
- Line 5: comment `"KING FLEXY DATA LTD"` → `"GAMER PLUG SOLUTION"`

---

## Phase 3 — Landing Page Completion (`app/page.tsx`)

### Sections to build / complete:
1. **Nav** — Logo, brand name, Login/Get Started CTA (already started)
2. **Hero** — Tagline, animated cyber-glow, stats bar (active users, networks, uptime)
3. **Networks Strip** — MTN / Telecel / AirtelTigo network cards
4. **How It Works** — 3-step: Create Account → Fund Wallet → Buy Data
5. **Features Grid** — Instant delivery, secure wallet, 24/7 support, API access, multi-network, role tiers
6. **Pricing Preview** — Sample package cards with network colors
7. **Social Proof** — Testimonial strip + community WhatsApp CTA
8. **Footer** — Brand, links, support email/WhatsApp (dynamic from DB)

### Design rules (all sections):
- Dark mode default, glassmorphic cards (`.glass-card`, `.cyber-card`)
- Electric blue (`hsl(217 100% 60%)`) primary CTAs
- Cyan glow (`hsl(195 100% 55%)`) accents
- Orbitron font for all headings, Rajdhani for body
- Grid scanline overlay on hero (already wired in `globals.css`)
- Mobile-first, responsive at sm/md/lg breakpoints

---

## Phase 4 — Dashboard Home Page (`app/dashboard/page.tsx`)

### Widgets to implement / polish:
1. **Welcome bar** — User name, role badge, wallet balance chip
2. **Quick Stats** — Total orders, pending orders, total spent (from DB)
3. **Quick Buy** — Network selector → package selector → phone input → Buy Now
4. **Recent Orders table** — Last 5 orders, status chips, network icons
5. **Wallet card** — Balance display, Top Up button, credit limit if applicable
6. **Community section** — WhatsApp group/channel links (dynamic from `admin_settings`)

---

## Phase 5 — Sidebar Polish (`components/dashboard/sidebar.tsx`)

- Confirm logo renders correctly at all collapse states
- Role badge color matches `lib/roles.ts` `roleConfig`
- Wallet balance live (already wired via Realtime in auth-context)
- Active route highlight with cyber-blue left border
- Mobile bottom nav drawer (already exists, verify styling)

---

## Environment Variables Required

These must be set in `.env.local` (dev) and Vercel dashboard (prod):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
BREVO_API_KEY=
BREVO_SENDER_NAME=GAMER PLUG
BREVO_SENDER_EMAIL=noreply@gamerplug.com
MOOLRE_API_KEY=
MOOLRE_SENDER_ID=GPLUG
MTN_API_KEY=
MTN_TARGET_ENV=
AT_ISHARE_API_KEY=
SPFASTIT_API_KEY=
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

---

## Execution Order

```
Phase 1  →  Fix clone_database.sql (you run this in Supabase SQL editor)
Phase 2  →  3-file brand rename (Claude executes)
Phase 3  →  Landing page build (Claude executes)
Phase 4  →  Dashboard home page (Claude executes)
Phase 5  →  Sidebar polish (Claude executes)
          →  git commit + push → Vercel auto-deploys
```
