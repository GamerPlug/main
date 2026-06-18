# GAMER PLUG SOLUTION — Mobile Data & Airtime Platform

A premium high-speed data and airtime platform for Ghana, built with Next.js 15, Tailwind CSS, and Supabase.

## 📡 About

**GAMER PLUG SOLUTION** is Ghana's #1 High-Speed Data Reselling & Supplier Platform — Powering Your Connection Instantly. Buy affordable data bundles for MTN, Telecel, and AirtelTigo instantly with a modern cyber-tech user experience.

## Features

- **User Dashboard**: Buy data, top-up wallet, view history, manage profile.
- **Admin Panel**: Manage users, orders, packages, complaints, finances, and system settings.
- **Wallet System**: Integrated wallet with Paystack top-ups and manual fulfillment.
- **Auto Fulfillment**: Integration with MTN and CodeCraft (Telecel/AT) APIs.
- **Agent System**: AFA (Authorized Field Agent) application and tracking.
- **Notifications**: Real-time updates for orders and payments.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Styling**: Tailwind CSS + shadcn/ui
- **Icons**: Lucide React
- **Payments**: Paystack

## Getting Started

### 1. Environment Setup

Copy `.env.example` and fill in your API keys:

```bash
cp .env.example .env
```

You will need keys for:
- Supabase (URL, Anon Key, Service Key)
- Paystack (Secret/Public Keys)
- MTN/CodeCraft/Moolre (if using actual APIs)

### 2. Database Setup

1. Create a new Supabase project.
2. Go to the SQL Editor in Supabase.
3. Copy the content of `supabase/clone_database.sql` and run it to create all tables, RLS policies, and RPC functions.
4. Enable Auth providers (Email/Password) in Supabase Authentication settings.

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the app.

## Admin Access

By default, new users are standard users. To make yourself an admin:
1. Sign up on the platform.
2. Go to your Supabase `users` table.
3. Find your user record and change the `role` from `customer` to `admin`.
4. Refresh the page to access the Admin Dashboard.

## Cron Jobs

The platform uses API routes for cron jobs (in `app/api/cron/`). Deploying to Vercel will automatically configure these if you set up the `CRON_SECRET` environment variable.

- `sync-mtn-status`: Updates MTN order statuses.
- `sync-codecraft-status`: Updates Telecel/AT order statuses.
- `verify-pending-payments`: Checks for abandoned/pending Paystack transactions.
