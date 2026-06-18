import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { requireAdmin } from '@/lib/admin-auth'

/**
 * Admin dashboard stats.
 *
 * Primary path: the `get_admin_dashboard_stats()` Postgres RPC aggregates
 * everything in a single round trip (see supabase/admin_dashboard_stats_migration.sql).
 * If that function isn't deployed yet, we transparently fall back to the legacy
 * "fetch + reduce in JS" approach so the dashboard never breaks.
 */
export async function GET(request: NextRequest) {
    try {
        // Verified admin (full admin only — the stats RPC requires 'admin').
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }
        if (auth.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // --- Primary: aggregated RPC (scales; self-guards on caller role) ---
        // Call with the user's session context so the RPC's auth.uid() guard passes.
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: rpcData, error: rpcError } = await supabaseUserClient.rpc('get_admin_dashboard_stats')
        if (!rpcError && rpcData) {
            return NextResponse.json(rpcData)
        }
        if (rpcError) {
            console.warn('[AdminStats] RPC unavailable, using query fallback:', rpcError.message)
        }

        // --- Fallback: legacy computation (service role bypasses RLS) -------
        const supabase = createServerClient()
        const [usersRes, ordersRes, walletsRes] = await Promise.all([
            supabase.from('users').select('created_at', { count: 'exact' }),
            supabase.from('orders').select('id, status, price, cost_price, network, size, phone_number, created_at'),
            supabase.from('wallets').select('balance'),
        ])

        const usersCount = usersRes.count || 0
        const orders = (ordersRes.data as any[]) || []
        const wallets = (walletsRes.data as any[]) || []

        const isToday = (d: string, ref: Date) => new Date(d).toDateString() === ref.toDateString()
        const now = new Date()
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
        const costOf = (o: any) => Number(o.cost_price) > 0 ? Number(o.cost_price) : Number(o.price) * 0.8

        const completed = orders.filter(o => o.status === 'completed')
        const totalOrders = orders.length
        const completedOrders = completed.length
        const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'processing').length
        const failedOrders = orders.filter(o => o.status === 'failed').length
        const totalRevenue = completed.reduce((s, o) => s + Number(o.price || 0), 0)
        const totalWalletBalance = wallets.reduce((s, w) => s + Number(w.balance || 0), 0)
        const successRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0

        const todayOrders = orders.filter(o => isToday(o.created_at, now)).length
        const yesterdayOrders = orders.filter(o => isToday(o.created_at, yesterday)).length
        const todayRevenue = completed.filter(o => isToday(o.created_at, now)).reduce((s, o) => s + Number(o.price || 0), 0)
        const yesterdayRevenue = completed.filter(o => isToday(o.created_at, yesterday)).reduce((s, o) => s + Number(o.price || 0), 0)
        const todayProfit = completed.filter(o => isToday(o.created_at, now)).reduce((s, o) => s + (Number(o.price || 0) - costOf(o)), 0)
        const newUsersToday = ((usersRes.data as any[]) || []).filter(u => isToday(u.created_at, now)).length

        // 7-day gap-filled series
        const series = [...Array(7)].map((_, i) => {
            const d = new Date(now); d.setDate(now.getDate() - (6 - i))
            const day = completed.filter(o => isToday(o.created_at, d))
            const allDay = orders.filter(o => isToday(o.created_at, d))
            return {
                date: d.toISOString().split('T')[0],
                revenue: day.reduce((s, o) => s + Number(o.price || 0), 0),
                profit: day.reduce((s, o) => s + (Number(o.price || 0) - costOf(o)), 0),
                orders: allDay.length,
            }
        })

        // 30-day network split (completed)
        const cutoff = new Date(now); cutoff.setDate(now.getDate() - 29)
        const splitMap = new Map<string, { orders: number; revenue: number }>()
        completed.filter(o => new Date(o.created_at) >= cutoff).forEach(o => {
            const k = o.network || 'Other'
            const cur = splitMap.get(k) || { orders: 0, revenue: 0 }
            splitMap.set(k, { orders: cur.orders + 1, revenue: cur.revenue + Number(o.price || 0) })
        })
        const networkSplit = Array.from(splitMap.entries())
            .map(([network, v]) => ({ network, ...v }))
            .sort((a, b) => b.revenue - a.revenue)

        const byNewest = (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        const pick = (o: any) => ({ id: o.id, network: o.network, size: o.size, phone_number: o.phone_number, price: o.price, status: o.status, created_at: o.created_at })
        const pendingQueue = orders.filter(o => o.status === 'pending' || o.status === 'processing').sort(byNewest).slice(0, 8).map(pick)
        const recentActivity = [...orders].sort(byNewest).slice(0, 8).map(pick)

        return NextResponse.json({
            totalUsers: usersCount,
            newUsersToday,
            totalOrders,
            completedOrders,
            pendingOrders,
            failedOrders,
            totalRevenue,
            totalWalletBalance,
            successRate,
            todayOrders,
            yesterdayOrders,
            todayRevenue,
            yesterdayRevenue,
            todayProfit,
            revenueDeltaPct: yesterdayRevenue > 0
                ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
                : (todayRevenue > 0 ? 100 : 0),
            ordersDeltaPct: yesterdayOrders > 0
                ? Math.round(((todayOrders - yesterdayOrders) / yesterdayOrders) * 100)
                : (todayOrders > 0 ? 100 : 0),
            series,
            networkSplit,
            pendingQueue,
            recentActivity,
        })
    } catch (error: any) {
        console.error('Admin Stats Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
