'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Wallet,
    Package,
    TrendingUp,
    Database,
    Plus,
    ArrowRight,
    CheckCircle2,
    Clock,
    XCircle,
    AlertCircle,
    ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSettings } from '@/hooks/use-settings'
import { Badge } from '@/components/ui/badge'

interface DashboardStats {
    walletBalance: number
    totalOrders: number
    completedOrders: number
    totalDataGB: number
    totalSpent: number
}

interface RecentOrder {
    id: string
    network: string
    size: string
    status: string
    amount: number
    created_at: string
}

function parseDataGB(size: string): number {
    if (!size) return 0
    const match = size.match(/^([\d.]+)\s*(GB|MB|KB)?$/i)
    if (!match) return 0
    const value = parseFloat(match[1])
    const unit = (match[2] || 'GB').toUpperCase()
    if (unit === 'MB') return value / 1024
    if (unit === 'KB') return value / (1024 * 1024)
    return value
}

function getGreeting(hour: number) {
    if (hour >= 5 && hour < 12) return { text: 'Good morning', emoji: '☀️' }
    if (hour >= 12 && hour < 17) return { text: 'Good afternoon', emoji: '🌤️' }
    if (hour >= 17 && hour < 21) return { text: 'Good evening', emoji: '🌆' }
    return { text: 'Good night', emoji: '🌙' }
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { label: string; className: string }> = {
        completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200' },
        pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200' },
        failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200' },
    }
    const config = map[status] ?? { label: status, className: 'bg-muted text-muted-foreground border-border' }
    return (
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border', config.className)}>
            {config.label}
        </span>
    )
}

export default function DashboardPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()
    const { settings } = useSettings()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [hour, setHour] = useState(new Date().getHours())

    useEffect(() => {
        const t = setInterval(() => setHour(new Date().getHours()), 60_000)
        return () => clearInterval(t)
    }, [])

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) fetchData()
            else setIsLoading(false)
        }
    }, [dbUser, isAuthLoading])

    useEffect(() => {
        if (!dbUser) return
        const channel = supabase
            .channel(`dash-${dbUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${dbUser.id}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${dbUser.id}` }, fetchData)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [dbUser])

    const fetchData = async () => {
        if (!dbUser?.id) return
        try {
            const [ordersRes, walletRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('id, network, size, status, amount, created_at')
                    .eq('user_id', dbUser.id)
                    .order('created_at', { ascending: false }),
                supabase
                    .from('wallets')
                    .select('balance, total_spent')
                    .eq('user_id', dbUser.id)
                    .single(),
            ])

            const orders = (ordersRes.data as RecentOrder[]) || []
            const wallet = walletRes.data as { balance: number; total_spent: number } | null

            const completedOrders = orders.filter(o => o.status === 'completed')
            const totalDataGB = completedOrders.reduce((acc, o) => acc + parseDataGB(o.size), 0)

            setStats({
                walletBalance: wallet?.balance ?? 0,
                totalOrders: orders.length,
                completedOrders: completedOrders.length,
                totalDataGB,
                totalSpent: wallet?.total_spent ?? 0,
            })
            setRecentOrders(orders.slice(0, 8))
        } catch (err) {
            console.error('Dashboard fetch error:', err)
        } finally {
            setIsLoading(false)
        }
    }

    const { text: greetText, emoji } = getGreeting(hour)
    const successRate = stats && stats.totalOrders > 0
        ? Math.round((stats.completedOrders / stats.totalOrders) * 100)
        : 0

    if (isLoading) {
        return (
            <div className="space-y-6 p-1">
                <Skeleton className="h-28 w-full rounded-2xl" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                </div>
                <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6">

            {/* ── Greeting Header ─────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-card border border-border rounded-2xl px-6 py-5 shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">
                        {greetText},{' '}
                        <span className="inline-block">{emoji}</span>{' '}
                        <span className="text-primary">{dbUser?.first_name}</span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Wallet, orders, and integrations in one place.
                    </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <Link href="/dashboard/wallet">
                        <Button variant="outline" className="h-10 px-4 font-semibold gap-2 border-border hover:border-primary/40">
                            <Plus className="w-4 h-4" />
                            Top up
                        </Button>
                    </Link>
                    <Link href="/dashboard/data-packages">
                        <Button className="h-10 px-5 font-semibold gap-2 bg-primary hover:bg-primary/90 text-white shadow-sm">
                            <Package className="w-4 h-4" />
                            New order
                        </Button>
                    </Link>
                </div>
            </div>

            {/* ── Stat Cards ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Wallet Balance */}
                <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <p className="text-sm text-muted-foreground font-medium">Wallet balance</p>
                        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                            <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                        <span className="text-sm font-semibold text-muted-foreground mr-0.5">GHS</span>
                        {stats?.walletBalance.toFixed(2) ?? '0.00'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">Available now</p>
                </div>

                {/* Orders */}
                <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <p className="text-sm text-muted-foreground font-medium">Orders</p>
                        <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                        {stats?.totalOrders ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        +{stats?.totalOrders ?? 0} total
                    </p>
                </div>

                {/* Success Rate */}
                <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <p className="text-sm text-muted-foreground font-medium">Success rate</p>
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                        {successRate}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                        {stats?.completedOrders ?? 0}/{stats?.totalOrders ?? 0} completed
                    </p>
                </div>

                {/* Data Delivered */}
                <div className="bg-white dark:bg-card border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-4">
                        <p className="text-sm text-muted-foreground font-medium">Data delivered</p>
                        <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                            <Database className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                        {(stats?.totalDataGB ?? 0).toFixed(1)}{' '}
                        <span className="text-sm font-semibold text-muted-foreground">GB</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                        GHS {(stats?.totalSpent ?? 0).toFixed(2)} spent
                    </p>
                </div>
            </div>

            {/* ── Recent Orders ────────────────────────────────────────── */}
            <div className="bg-white dark:bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">Recent orders</h2>
                    <Link
                        href="/dashboard/my-orders"
                        className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
                    >
                        View all <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {recentOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <Package className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-1">No orders yet</p>
                        <p className="text-xs text-muted-foreground mb-4">Your orders will appear here once you place one.</p>
                        <Link href="/dashboard/data-packages">
                            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white font-semibold">
                                Place your first order
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Service</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Size</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Charged</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {recentOrders.map(order => (
                                    <tr key={order.id} className="hover:bg-muted/20 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <p className="font-semibold text-foreground">{order.network}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {new Date(order.created_at).toLocaleDateString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false,
                                                })}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3.5 text-foreground font-medium">
                                            {order.size || '—'}
                                        </td>
                                        <td className="px-4 py-3.5">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="px-6 py-3.5 text-right font-semibold text-foreground">
                                            GHS {Number(order.amount).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Community Section ────────────────────────────────────── */}
            <div className="bg-white dark:bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-5">
                <div className="flex-1 text-center md:text-left">
                    <h3 className="text-base font-semibold text-foreground mb-1">Join the Community</h3>
                    <p className="text-sm text-muted-foreground">
                        Connect with other resellers. Get real-time updates, flash deals, and 24/7 support.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <a
                        href={settings.whatsappGroupLink || 'https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 text-[#25D366] font-semibold text-sm transition-all"
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Join Group
                    </a>
                    <a
                        href={settings.whatsappChannelLink || 'https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366]/10 border border-[#25D366]/30 hover:bg-[#25D366]/20 text-[#25D366] font-semibold text-sm transition-all"
                    >
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        Join Channel
                    </a>
                </div>
            </div>
        </div>
    )
}
