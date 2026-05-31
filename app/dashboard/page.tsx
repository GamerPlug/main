'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
    ShoppingCart,
    CheckCircle2,
    Clock,
    XCircle,
    Wallet,
    Package,
    AlertCircle,
    Plus,
    Crown,
    Shield,
    Star,
    Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTutorial } from '@/hooks/useTutorial'
import { HelpButton } from '@/components/tutorial/HelpButton'

interface DashboardStats {
    totalOrders: number
    completedOrders: number
    processingOrders: number
    failedOrders: number
    pendingOrders: number
    walletBalance: number
}


import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'
import { useSettings } from '@/hooks/use-settings'

export default function DashboardPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()
    const { settings } = useSettings()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [currentTime, setCurrentTime] = useState(new Date())

    const isAdmin = dbUser?.role === 'admin' || (dbUser?.role as string) === 'superadmin'

    // Tutorial hook - page-specific
    const userRole = dbUser?.role === 'agent' ? 'agent' : 'user'
    const { hasSeenTutorial, startTutorial } = useTutorial(userRole as 'user' | 'agent', '/dashboard')

    // Real-time clock updater
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date())
        }, 1000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) {
                fetchDashboardData()
            } else {
                // Not authenticated or user data missing, stop loading
                setIsLoading(false)
            }
        }
    }, [dbUser, isAuthLoading])

    // Real-time subscriptions for live updates
    useEffect(() => {
        if (!dbUser) return

        const channel = supabase
            .channel(`dashboard-${dbUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchDashboardData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchDashboardData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dbUser])

    // Auto-start tutorial for first-time users
    useEffect(() => {
        if (!isLoading && !hasSeenTutorial && dbUser) {
            // Delay 1 second for page to fully load
            const timer = setTimeout(() => {
                startTutorial()
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [isLoading, hasSeenTutorial, dbUser, startTutorial])

    // Helper functions for greeting box
    const getGreeting = () => {
        const hour = currentTime.getHours()
        if (hour >= 5 && hour < 12) return 'Good Morning'
        if (hour >= 12 && hour < 17) return 'Good Afternoon'
        if (hour >= 17 && hour < 21) return 'Good Evening'
        return 'Good Night'
    }

    const formatDateTime = () => {
        const dateStr = currentTime.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        const timeStr = currentTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        })
        return { dateStr, timeStr }
    }

    const getTimeSinceJoined = () => {
        if (!dbUser?.created_at) return 'Recently'
        const now = new Date()
        const joined = new Date(dbUser.created_at)
        const diffMs = now.getTime() - joined.getTime()
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

        if (diffDays < 30) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30)
            return `${months} ${months === 1 ? 'month' : 'months'} ago`
        }
        const years = Math.floor(diffDays / 365)
        return `${years} ${years === 1 ? 'year' : 'years'} ago`
    }

    const fetchDashboardData = async () => {
        try {
            const [ordersRes, walletRes] = await Promise.all([
                supabase
                    .from('orders')
                    .select('status, price')
                    .eq('user_id', dbUser?.id as any),
                supabase
                    .from('wallets')
                    .select('balance')
                    .eq('user_id', dbUser?.id as any)
                    .single()
            ])

            if (ordersRes.error) throw ordersRes.error
            
            const orders = ordersRes.data || []
            const wallet = walletRes.data

            const totalOrders = orders.length
            const completedOrders = orders.filter(o => o.status === 'completed').length
            const processingOrders = orders.filter(o => o.status === 'processing' || o.status === 'pending').length
            const failedOrders = orders.filter(o => o.status === 'failed').length
            const pendingOrders = orders.filter(o => o.status === 'pending').length

            setStats({
                totalOrders,
                completedOrders,
                processingOrders,
                failedOrders,
                pendingOrders,
                walletBalance: (wallet as any)?.balance || 0
            })
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Card key={i} className="glass-card border-white/5 border-t-white/10">
                            <CardContent className="p-4 sm:p-6">
                                <Skeleton className="h-4 w-24 mb-3 bg-white/10" />
                                <Skeleton className="h-8 w-16 bg-white/10" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        )
    }

    const { dateStr, timeStr } = formatDateTime()

    return (
        <div className="space-y-6 relative z-10">
            {/* Tutorial Help Button */}
            <div className="flex justify-end">
                <HelpButton onClick={startTutorial} />
            </div>

            {/* Greeting Box - Agent & Dealer */}
            {(dbUser?.role === 'agent' || dbUser?.role === 'dealer') && (() => {
                const isDealer = dbUser?.role === 'dealer';
                const theme = isDealer
                    ? {
                        bg: "from-purple-600 via-indigo-600 to-purple-800",
                        border: "border-purple-400/30",
                        shadow: "shadow-[0_0_40px_rgba(124,58,237,0.3)]",
                        label: "Authorized Dealer",
                        labelGradient: "from-fuchsia-400 to-purple-400"
                    }
                    : {
                        bg: "from-yellow-400 via-amber-500 to-yellow-600",
                        border: "border-yellow-300/30",
                        shadow: "shadow-[0_0_40px_rgba(245,158,11,0.3)]",
                        label: "Authorized Agent",
                        labelGradient: "from-emerald-400 to-cyan-400"
                    };

                return (
                    <div className={cn(
                    "p-6 rounded-3xl border transition-all duration-300 backdrop-blur-xl relative overflow-hidden group",
                    (dbUser?.role === 'agent')
                        ? "bg-yellow-50/50 dark:bg-yellow-500/10 border-yellow-200/50 dark:border-yellow-500/20 shadow-sm dark:shadow-[0_8px_32px_rgba(234,179,8,0.15)]"
                        : (dbUser?.role === 'dealer')
                            ? "bg-purple-50/50 dark:bg-purple-500/10 border-purple-200/50 dark:border-purple-500/20 shadow-sm dark:shadow-[0_8px_32px_rgba(168,85,247,0.15)]"
                            : "bg-white/50 dark:bg-black/40 border-slate-200 dark:border-white/10 shadow-sm dark:shadow-xl"
                )}>
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20 mix-blend-overlay"></div>
                        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[300px] h-[300px] bg-white/30 rounded-full blur-[80px] opacity-40 group-hover:opacity-60 transition-opacity"></div>

                        {/* Greeting and Date/Time Row */}
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                            <div className="flex items-center gap-3">
                                <Sparkles className={cn("w-8 h-8 sm:w-10 sm:h-10 text-slate-900 fill-slate-900/10 dark:text-white dark:fill-white/20", isDealer && "dark:text-white dark:fill-white/20")} />
                                <h2 className={cn("text-2xl sm:text-3xl font-black tracking-tight drop-shadow-sm text-slate-900 dark:text-white", isDealer && "dark:text-white")}>
                                    {getGreeting()}, {dbUser?.first_name}!
                                </h2>
                            </div>
                            <div className={cn("flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-0 font-medium text-slate-600 dark:text-slate-300", isDealer && "dark:text-white/80")}>
                                <p className="text-sm sm:text-base">{dateStr}</p>
                                <p className={cn("text-base sm:text-xl font-black tracking-tight text-slate-900 dark:text-white", isDealer && "dark:text-white")}>{timeStr}</p>
                            </div>
                        </div>

                        {/* Two Information Rows (Membership is permanent now) */}
                        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Row 1: Role */}
                            <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 flex flex-col justify-center border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className={cn("w-4 h-4", isDealer ? "text-purple-500" : "text-slate-400 dark:text-slate-500")} />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Your Position</p>
                                </div>
                                <p className={cn("text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r", theme.labelGradient)}>
                                    {theme.label}
                                </p>
                            </div>

                            {/* Row 2: Member Since */}
                            <div className="bg-white/80 dark:bg-black/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 flex flex-col justify-center border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Star className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Member Since</p>
                                </div>
                                <p className="text-base sm:text-lg font-black text-slate-800 dark:text-white">
                                    {getTimeSinceJoined()}
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}
            {/* Joseph: Fixed closing structure */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 {[
                    { label: 'Total Orders', value: stats?.totalOrders, icon: ShoppingCart, gradient: 'from-blue-500 to-cyan-400', glow: 'shadow-[0_0_20px_rgba(56,189,248,0.3)]' },
                    { label: 'Completed', value: stats?.completedOrders, icon: CheckCircle2, gradient: 'from-emerald-400 to-green-500', glow: 'shadow-[0_0_20px_rgba(52,211,153,0.3)]' },
                    { label: 'Failed', value: stats?.failedOrders, icon: XCircle, gradient: 'from-red-500 to-rose-600', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.3)]' },
                ].map((stat, idx) => (
                    <div key={idx} className="glass-card rounded-2xl p-5 border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl hover:bg-white/90 dark:hover:bg-white/[0.03] transition-all relative overflow-hidden group">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-bold tracking-wide">{stat.label}</p>
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${stat.gradient} ${stat.glow} flex items-center justify-center`}>
                                <stat.icon className="w-5 h-5 text-white drop-shadow-sm" />
                            </div>
                        </div>
                        <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">
                            {stat.value !== undefined ? stat.value : <span className="animate-pulse text-slate-300 dark:text-slate-600">--</span>}
                        </p>
                        {/* Edge lighting effect */}
                        <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-slate-200 dark:via-white/20 to-transparent"></div>
                    </div>
                ))}
            </div>

            {/* Wallet & Quick Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                 {/* Wallet Card */}
                <div id="wallet-card" className="lg:col-span-1 rounded-[2rem] glass-card border-slate-200 dark:border-white/10 relative overflow-hidden p-8 flex flex-col justify-between group h-full shadow-sm dark:shadow-xl">
                    {/* Glowing Orbs */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors"></div>
                    <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-yellow-500/5 dark:bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/10 dark:group-hover:bg-yellow-500/20 transition-colors"></div>

                    <div className="relative z-10 w-full">
                        <div className="flex items-center justify-between mb-8">
                            <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-xs">Wallet Balance</p>
                            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 backdrop-blur-md text-slate-900 dark:text-white shadow-sm dark:shadow-xl">
                                <Wallet className="w-5 h-5" />
                            </div>
                        </div>
                        <p className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-tight drop-shadow-sm dark:drop-shadow-lg break-words">
                            <span className="text-lg md:text-3xl text-slate-400 dark:text-slate-500 font-bold mr-1">GH₵</span>
                            {stats?.walletBalance !== undefined ? stats.walletBalance.toFixed(2) : '--'}
                        </p>
                    </div>

                    <div className="relative z-10 mt-8">
                        {!(process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true' && !isAdmin) && (
                            <Link href="/dashboard/wallet">
                                <Button className="w-full gradient-primary hover:glow-primary text-white border-0 h-12 rounded-xl text-lg font-black uppercase tracking-wider shadow-lg hover:-translate-y-1 transition-all">
                                    <Plus className="w-5 h-5 mr-2" />
                                    Top Up Connect
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-2 rounded-[2rem] glass-card border-white/10 p-6 sm:p-8 h-full">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Quick Actions</h2>
                        <div className="h-px w-full bg-gradient-to-r from-slate-200 dark:from-white/10 to-transparent flex-1 ml-6 hidden sm:block"></div>
                    </div>

                    <div id="data-packages" className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { name: 'Buy Data', desc: 'MTN, Telecel...', icon: Package, href: '/dashboard/data-packages', color: 'bg-yellow-500 text-yellow-900 border-yellow-500/50 glow: shadow-[0_0_15px_rgba(234,179,8,0.3)]' },
                            { name: 'My Orders', desc: 'Track history', icon: ShoppingCart, href: '/dashboard/my-orders', color: 'bg-blue-500 text-blue-900 border-blue-500/50 glow: shadow-[0_0_15px_rgba(59,130,246,0.3)]' },
                            { name: 'Top Up', desc: 'Add funds', icon: Wallet, href: '/dashboard/wallet', color: 'bg-green-500 text-green-900 border-green-500/50 glow: shadow-[0_0_15px_rgba(34,197,94,0.3)]' },
                            { name: 'Complaints', desc: 'Get support', icon: AlertCircle, href: '/dashboard/complaints', color: 'bg-red-500 text-red-900 border-red-500/50 glow: shadow-[0_0_15px_rgba(239,68,68,0.3)]' },
                        ].map((action, idx) => (
                            <Link key={idx} href={action.href}>
                                <div className="p-4 sm:p-5 rounded-[1.5rem] bg-white/[0.03] border border-white/10 hover:bg-white/[0.08] hover:border-white/20 hover:shadow-xl transition-all cursor-pointer group flex flex-col items-center sm:items-start text-center sm:text-left h-full">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${action.color.split(' glow: ')[0]}`}>
                                        <action.icon className="w-6 h-6" />
                                    </div>
                                    <p className="font-bold text-slate-900 dark:text-white text-base tracking-wide mb-1">{action.name}</p>
                                    <p className="text-xs text-slate-400 font-medium">{action.desc}</p>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>

            {/* Community Section */}
            <div id="community-section" className="pt-8">
                <div className="glass-card rounded-[2rem] border-white/10 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden">
                    <div className="absolute right-0 top-0 w-64 h-64 bg-[#25D366]/10 rounded-full blur-[80px] pointer-events-none"></div>
                    <div className="flex-1 text-center md:text-left z-10">
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Join The Community</h3>
                        <p className="text-sm text-slate-400 font-medium max-w-md">Connect with thousands of users. Get real-time updates, flash deals, and 24/7 support.</p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto z-10">
                        <a
                            href={settings.whatsappGroupLink || "https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV?mode=gi_t"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/30 hover:bg-[#25D366]/30 text-[#25D366] font-bold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(37,211,102,0.1)] hover:scale-105"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Join Group
                        </a>
                        <a
                            href={settings.whatsappChannelLink || "https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 sm:flex-none flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-[#25D366]/20 border border-[#25D366]/30 hover:bg-[#25D366]/30 text-[#25D366] font-bold text-sm transition-all duration-300 shadow-[0_0_15px_rgba(37,211,102,0.1)] hover:scale-105"
                        >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                            Join Channel
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
