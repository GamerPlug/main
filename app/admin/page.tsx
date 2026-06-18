'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/auth-context'
import { cn, formatCurrency, formatRelativeTime } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'
import { StatTile, type Tone } from '@/components/admin/stat-tile'
import { AreaChart, type AreaPoint } from '@/components/admin/charts'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Users,
    ShoppingCart,
    Wallet,
    CheckCircle2,
    TrendingUp,
    Clock,
    DollarSign,
    XCircle,
    Activity,
    RefreshCw,
    ArrowUpRight,
    ArrowDownRight,
    ArrowRight,
    Package,
    MessageSquare,
    Bell,
    Key,
    Settings,
    AlertTriangle,
    Inbox,
    Signal,
} from 'lucide-react'

interface SeriesPoint { date: string; revenue: number; profit: number; orders: number }
interface NetworkSlice { network: string; orders: number; revenue: number }
interface OrderRow { id: string; network: string; size: string; phone_number: string; price: number; status: string; created_at: string }

interface AdminStats {
    totalUsers: number
    newUsersToday: number
    totalOrders: number
    completedOrders: number
    pendingOrders: number
    failedOrders: number
    totalRevenue: number
    totalWalletBalance: number
    successRate: number
    todayOrders: number
    yesterdayOrders: number
    todayRevenue: number
    yesterdayRevenue: number
    todayProfit: number
    revenueDeltaPct: number
    ordersDeltaPct: number
    series: SeriesPoint[]
    networkSplit: NetworkSlice[]
    pendingQueue: OrderRow[]
    recentActivity: OrderRow[]
}

type ChartMetric = 'revenue' | 'profit' | 'orders'

function getGreeting(hour: number) {
    if (hour >= 5 && hour < 12) return 'Good morning'
    if (hour >= 12 && hour < 17) return 'Good afternoon'
    if (hour >= 17 && hour < 21) return 'Good evening'
    return 'Good night'
}

function networkGradient(network: string): string {
    const n = (network || '').toLowerCase()
    if (n.includes('mtn')) return 'gradient-mtn'
    if (n.includes('telecel') || n.includes('voda')) return 'gradient-telecel'
    if (n.includes('airtel') || n.includes('tigo') || n.startsWith('at')) return 'gradient-airteltigo'
    return 'gradient-cyber'
}

function StatusChip({ status }: { status: string }) {
    const map: Record<string, string> = {
        pending: 'status-pending',
        processing: 'status-processing',
        completed: 'status-completed',
        failed: 'status-failed',
    }
    return (
        <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize', map[status] ?? 'bg-muted text-muted-foreground border-border')}>
            {status}
        </span>
    )
}

const QUICK_ACTIONS: { href: string; label: string; icon: typeof ShoppingCart; tone: Tone }[] = [
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, tone: 'blue' },
    { href: '/admin/users', label: 'Users', icon: Users, tone: 'violet' },
    { href: '/admin/packages', label: 'Packages', icon: Package, tone: 'emerald' },
    { href: '/admin/profits-history', label: 'Profits', icon: Wallet, tone: 'teal' },
    { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare, tone: 'rose' },
    { href: '/admin/announcements', label: 'Announce', icon: Bell, tone: 'amber' },
    { href: '/admin/sms-broadcast', label: 'SMS', icon: MessageSquare, tone: 'cyan' },
    { href: '/admin/api-management', label: 'API Keys', icon: Key, tone: 'indigo' },
    { href: '/admin/settings', label: 'Settings', icon: Settings, tone: 'blue' },
]

const CHART_ACCENT: Record<ChartMetric, string> = {
    revenue: 'text-primary',
    profit: 'text-emerald-500',
    orders: 'text-violet-500',
}

export default function AdminDashboardPage() {
    const { dbUser } = useAuth()
    const [stats, setStats] = useState<AdminStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [lastSynced, setLastSynced] = useState<Date | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const [chartMetric, setChartMetric] = useState<ChartMetric>('revenue')

    const heroRevenue = useCountUp(stats?.todayRevenue ?? 0)

    const fetchStats = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/stats')
            if (!response.ok) {
                const result = await response.json().catch(() => ({}))
                throw new Error(result.error || `Request failed (${response.status})`)
            }
            const data = await response.json()
            setStats(data)
            setError(null)
            setLastSynced(new Date())
        } catch (err: any) {
            console.error('Error fetching admin stats:', err)
            setError(err.message || 'Failed to load dashboard')
        } finally {
            setIsLoading(false)
            setRefreshing(false)
        }
    }, [])

    useEffect(() => {
        fetchStats()
    }, [fetchStats])

    // Real-time updates — debounced so a bulk purchase doesn't trigger a storm.
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null
        const debounced = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(fetchStats, 600)
        }
        const channel = supabase
            .channel('admin-dashboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, debounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, debounced)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets' }, debounced)
            .subscribe()
        return () => {
            if (timer) clearTimeout(timer)
            supabase.removeChannel(channel)
        }
    }, [fetchStats])

    const handleRefresh = () => {
        setRefreshing(true)
        fetchStats()
    }

    const greeting = getGreeting(new Date().getHours())

    const chartData: AreaPoint[] = useMemo(() => {
        if (!stats) return []
        return stats.series.map((p) => ({
            label: new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' }),
            value: p[chartMetric],
        }))
    }, [stats, chartMetric])

    const revenueSpark = useMemo(() => stats?.series.map((p) => p.revenue) ?? [], [stats])
    const ordersSpark = useMemo(() => stats?.series.map((p) => p.orders) ?? [], [stats])
    const maxNetworkRevenue = useMemo(
        () => Math.max(1, ...(stats?.networkSplit.map((n) => n.revenue) ?? [1])),
        [stats]
    )

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
                    <Skeleton className="h-72 rounded-2xl" />
                </div>
            </div>
        )
    }

    if (error && !stats) {
        return (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                    <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <h2 className="mt-4 text-lg font-bold text-foreground">Couldn&apos;t load the dashboard</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
                <Button onClick={handleRefresh} className="mt-5 gap-2">
                    <RefreshCw className="h-4 w-4" /> Try again
                </Button>
            </div>
        )
    }

    const s = stats!
    const revUp = s.revenueDeltaPct >= 0

    return (
        <div className="space-y-6">

            {/* ── HERO ─────────────────────────────────────────────────── */}
            <div className="admin-hero relative rounded-3xl border border-border p-6 shadow-sm lg:p-8">
                <div className="glow-orb -left-10 -top-10 h-40 w-40 bg-primary/30" />
                <div className="glow-orb right-0 top-0 h-40 w-40 bg-violet-500/20" />

                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                            <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-emerald-500" />
                            Live · Mission Control
                        </div>
                        <h1 className="mt-2 text-2xl font-bold text-foreground lg:text-3xl">
                            {greeting}, <span className="text-primary">{dbUser?.first_name || 'Admin'}</span>
                        </h1>

                        <div className="mt-5">
                            <p className="text-sm font-medium text-muted-foreground">Revenue today</p>
                            <div className="mt-1 flex flex-wrap items-end gap-3">
                                <p className="text-4xl font-black tracking-tight text-foreground tabular-nums lg:text-5xl">
                                    {formatCurrency(heroRevenue)}
                                </p>
                                <span className={cn(
                                    'mb-1.5 inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
                                    revUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                )}>
                                    {revUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                                    {Math.abs(s.revenueDeltaPct)}% vs yesterday
                                </span>
                            </div>
                        </div>

                        {/* hero mini-metrics */}
                        <div className="mt-5 flex flex-wrap gap-2.5">
                            <HeroChip icon={TrendingUp} label="Profit today" value={formatCurrency(s.todayProfit)} />
                            <HeroChip icon={ShoppingCart} label="Orders today" value={String(s.todayOrders)} />
                            <HeroChip icon={Users} label="New users" value={`+${s.newUsersToday}`} />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 lg:flex-col lg:items-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="gap-2 bg-card/60 backdrop-blur"
                        >
                            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                            Refresh
                        </Button>
                        {lastSynced && (
                            <p className="text-[11px] font-medium text-muted-foreground">
                                Updated {lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── KPI ROW ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile label="Total Revenue" value={s.totalRevenue} icon={DollarSign} tone="teal" format="currency" sparkline={revenueSpark} sublabel="all-time" />
                <StatTile label="Total Orders" value={s.totalOrders} icon={ShoppingCart} tone="blue" deltaPct={s.ordersDeltaPct} sublabel={`${s.todayOrders} today`} sparkline={ordersSpark} />
                <StatTile label="Completed" value={s.completedOrders} icon={CheckCircle2} tone="emerald" sublabel={`${s.successRate}% success`} />
                <StatTile label="Pending" value={s.pendingOrders} icon={Clock} tone="amber" sublabel="awaiting action" />
                <StatTile label="Total Users" value={s.totalUsers} icon={Users} tone="violet" sublabel={`+${s.newUsersToday} today`} />
                <StatTile label="Wallet Float" value={s.totalWalletBalance} icon={Wallet} tone="indigo" format="currency" sublabel="customer balances" />
                <StatTile label="Success Rate" value={s.successRate} icon={TrendingUp} tone="cyan" format="percent" sublabel="completed / total" />
                <StatTile label="Failed" value={s.failedOrders} icon={XCircle} tone="rose" sublabel="needs review" />
            </div>

            {/* ── CHARTS ROW ───────────────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">

                {/* Trend chart */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-foreground">Performance · last 7 days</h2>
                            <p className="text-xs text-muted-foreground">Hover the chart for daily detail</p>
                        </div>
                        <div className="flex rounded-lg border border-border bg-muted/40 p-0.5">
                            {(['revenue', 'profit', 'orders'] as ChartMetric[]).map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setChartMetric(m)}
                                    className={cn(
                                        'rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors',
                                        chartMetric === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="mt-4">
                        <AreaChart
                            data={chartData}
                            accentClass={CHART_ACCENT[chartMetric]}
                            formatValue={(n) => chartMetric === 'orders' ? `${Math.round(n)} orders` : formatCurrency(n)}
                        />
                    </div>
                </div>

                {/* Network split */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <h2 className="text-base font-bold text-foreground">Network split</h2>
                        <Signal className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">Completed · last 30 days</p>

                    <div className="mt-4 space-y-4">
                        {s.networkSplit.length === 0 ? (
                            <p className="py-8 text-center text-sm text-muted-foreground">No completed orders yet</p>
                        ) : s.networkSplit.map((n) => (
                            <div key={n.network}>
                                <div className="mb-1.5 flex items-center justify-between text-sm">
                                    <span className="font-semibold text-foreground">{n.network}</span>
                                    <span className="font-bold text-foreground tabular-nums">{formatCurrency(n.revenue)}</span>
                                </div>
                                <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                                    <div
                                        className={cn('h-full rounded-full', networkGradient(n.network))}
                                        style={{ width: `${Math.max((n.revenue / maxNetworkRevenue) * 100, 4)}%` }}
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-muted-foreground">{n.orders.toLocaleString()} orders</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── QUEUE + ACTIVITY ─────────────────────────────────────── */}
            <div className="grid gap-4 lg:grid-cols-3">

                {/* Pending queue */}
                <div className="rounded-2xl border border-border bg-card shadow-sm lg:col-span-2">
                    <div className="flex items-center justify-between border-b border-border px-5 py-4">
                        <div className="flex items-center gap-2">
                            <Inbox className="h-4 w-4 text-amber-500" />
                            <h2 className="text-base font-bold text-foreground">Pending queue</h2>
                            {s.pendingOrders > 0 && (
                                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
                                    {s.pendingOrders}
                                </span>
                            )}
                        </div>
                        <Link href="/admin/orders" className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80">
                            Manage <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {s.pendingQueue.length === 0 ? (
                        <div className="flex flex-col items-center justify-center px-5 py-12 text-center">
                            <CheckCircle2 className="h-8 w-8 text-emerald-500/50" />
                            <p className="mt-2 text-sm font-semibold text-foreground">All caught up</p>
                            <p className="text-xs text-muted-foreground">No pending or processing orders.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {s.pendingQueue.map((o) => (
                                <Link
                                    key={o.id}
                                    href="/admin/orders"
                                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                                >
                                    <div className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[10px] font-bold uppercase', networkGradient(o.network))}>
                                        {(o.network || '?').slice(0, 3)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-foreground">
                                            {o.size} · {o.network}
                                        </p>
                                        <p className="truncate text-xs text-muted-foreground">
                                            {o.phone_number} · {formatRelativeTime(o.created_at)}
                                        </p>
                                    </div>
                                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                                        <span className="text-sm font-bold text-foreground tabular-nums">{formatCurrency(Number(o.price))}</span>
                                        <StatusChip status={o.status} />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent activity */}
                <div className="rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex items-center gap-2 border-b border-border px-5 py-4">
                        <Activity className="h-4 w-4 text-primary" />
                        <h2 className="text-base font-bold text-foreground">Recent activity</h2>
                    </div>
                    {s.recentActivity.length === 0 ? (
                        <p className="px-5 py-12 text-center text-sm text-muted-foreground">No recent orders</p>
                    ) : (
                        <div className="divide-y divide-border">
                            {s.recentActivity.map((o) => (
                                <div key={o.id} className="flex items-center gap-3 px-5 py-3">
                                    <span className={cn(
                                        'mt-0.5 h-2 w-2 flex-shrink-0 rounded-full',
                                        o.status === 'completed' ? 'bg-emerald-500'
                                            : o.status === 'failed' ? 'bg-rose-500'
                                                : o.status === 'processing' ? 'bg-blue-500' : 'bg-amber-500'
                                    )} />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-foreground">
                                            {o.size} · {o.network}
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">{formatRelativeTime(o.created_at)}</p>
                                    </div>
                                    <span className="text-xs font-bold text-foreground tabular-nums">{formatCurrency(Number(o.price))}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── QUICK ACTIONS ────────────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <h2 className="mb-4 text-base font-bold text-foreground">Quick actions</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {QUICK_ACTIONS.map((a) => (
                        <Link
                            key={a.href}
                            href={a.href}
                            className="group flex flex-col items-center gap-2 rounded-xl border border-border bg-muted/30 p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-muted/60 hover:shadow-sm"
                        >
                            <QuickIcon icon={a.icon} tone={a.tone} />
                            <span className="text-sm font-semibold text-foreground">{a.label}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ---------- small presentational helpers ---------- */

function HeroChip({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card/60 px-3 py-2 backdrop-blur">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div className="leading-tight">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-sm font-bold text-foreground tabular-nums">{value}</p>
            </div>
        </div>
    )
}

const QUICK_TONES: Record<Tone, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400',
    teal: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-400',
}

function QuickIcon({ icon: Icon, tone }: { icon: typeof ShoppingCart; tone: Tone }) {
    return (
        <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110', QUICK_TONES[tone])}>
            <Icon className="h-5 w-5" />
        </div>
    )
}
