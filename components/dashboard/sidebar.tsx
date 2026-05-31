'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Wallet,
    User,
    MessageSquare,
    Bell,
    Users,
    ChevronLeft,
    ChevronRight,
    LogOut,
    Settings,
    Shield,
    Crown,
    Star,
    BadgeCheck,
    UserCircle,
    Plus,
    Code2,
    Key,
    Zap,
    CreditCard
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { usePageAccess } from '@/hooks/use-page-access'


const userNavItems = [
    { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
    { href: '/dashboard/data-packages', label: 'Data Packages', icon: Package },
    { href: '/dashboard/my-orders', label: 'Orders', icon: ShoppingCart },
    { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
    { href: '/dashboard/afa-orders', label: 'AFA Application', icon: BadgeCheck },
    { href: '/dashboard/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
    { href: '/dashboard/developer', label: 'Developer API', icon: Code2 },
]

const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: Shield },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
    { href: '/admin/afa-management', label: 'AFA Management', icon: BadgeCheck },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/packages', label: 'Packages', icon: Package },
    { href: '/admin/complaints', label: 'Complaints', icon: MessageSquare },
    { href: '/admin/announcements', label: 'Announce', icon: Bell },
    { href: '/admin/sms-broadcast', label: 'SMS', icon: MessageSquare },
    { href: '/admin/profits-history', label: 'Profits', icon: Wallet },
    { href: '/admin/api-management', label: 'API Management', icon: Key },
    { href: '/admin/ishare-logs', label: 'iShare Logs', icon: Zap },
    { href: '/admin/payment-status', label: 'Payment Status', icon: CreditCard },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
]

import { roleConfig } from '@/lib/roles'

export function DashboardSidebar() {
    const pathname = usePathname()
    const { dbUser, isAdmin, isSubAdmin, signOut } = useAuth()
    const { isInternalSidebarOpen, closeSidebar } = useUI()
    const { isPageAccessible, loading: pageAccessLoading } = usePageAccess()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [walletBalance, setWalletBalance] = useState(0)

    // Fetch wallet balance
    useEffect(() => {
        const fetchBalance = async () => {
            if (!dbUser?.id) return
            const { data } = await (supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', dbUser.id)
                .single() as any)
            if (data) setWalletBalance(data.balance || 0)
        }
        fetchBalance()
    }, [dbUser?.id])

    const isLinkActive = (href: string) => {
        if (href === '/dashboard' || href === '/admin') {
            return pathname === href
        }
        return pathname?.startsWith(href)
    }

    // Get role config
    const userRole = isAdmin ? 'admin' : isSubAdmin ? 'sub-admin' : (dbUser?.role || 'user') as keyof typeof roleConfig
    const currentRole = roleConfig[userRole] || roleConfig['user']
    const RoleIcon = currentRole.icon

    return (
        <>
            {/* Mobile Overlay */}
            {isInternalSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed left-0 top-0 z-50 h-full flex flex-col transition-all duration-300 ease-in-out border-r",
                    (dbUser?.role === 'agent')
                        ? "bg-yellow-50/80 dark:bg-slate-950/80 backdrop-blur-2xl border-yellow-200/50 dark:border-white/10 shadow-[4px_0_24px_-4px_rgba(234,179,8,0.1)] text-slate-900 dark:text-white"
                        : (dbUser?.role === 'dealer')
                            ? "bg-purple-50/80 dark:bg-slate-950/80 backdrop-blur-2xl border-purple-200/50 dark:border-white/10 shadow-[4px_0_24px_-4px_rgba(168,85,247,0.1)] text-slate-900 dark:text-white"
                            : "bg-white/80 dark:bg-black/80 backdrop-blur-2xl border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[4px_0_24px_-4px_rgba(0,0,0,0.3)] text-slate-900 dark:text-white",
                    isCollapsed ? "w-20" : "w-[280px] sm:w-[300px]",
                    "transform lg:transform-none pt-4 pb-4",
                    isInternalSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
                )}
            >
                {/* Logo Header */}
                <div className="flex items-center justify-between px-4 sm:px-6 mb-8 mt-2 relative z-10">
                    <Link href="/dashboard" className="flex items-center gap-3.5 group">
                        <div className="relative w-11 h-11 flex-shrink-0 transition-transform duration-500 group-hover:scale-105">
                            <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg group-hover:bg-primary/40 transition-colors"></div>
                            <div className="w-full h-full rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-white/10 flex items-center justify-center shadow-xl relative z-10">
                                <Image
                                    src="/logo.png"
                                    alt="EASYDATA"
                                    fill
                                    className="object-contain p-1.5 drop-shadow-lg"
                                    priority
                                />
                            </div>
                            {dbUser?.role === 'agent' && (
                                <Crown className="absolute -top-3 -left-3 w-6 h-6 text-yellow-500 fill-yellow-500/20 -rotate-12 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)] z-20 animate-pulseGlow" />
                            )}
                            {dbUser?.role === 'dealer' && (
                                <Crown className="absolute -top-3 -left-3 w-6 h-6 text-purple-500 fill-purple-500/20 -rotate-12 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] z-20 animate-pulseGlow" />
                            )}
                        </div>
                        {!isCollapsed && (
                            <div className="flex flex-col transition-transform duration-500 group-hover:translate-x-1">
                                <span className="text-lg font-black tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
                                    EASYDATA
                                </span>
                                <span className="text-[10px] font-bold text-primary uppercase tracking-widest drop-shadow-[0_0_8px_rgba(225,0,255,0.2)] dark:drop-shadow-[0_0_8px_rgba(225,0,255,0.4)]">PREMIUM DATA</span>
                            </div>
                        )}
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="hidden lg:flex text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 w-8 h-8 rounded-full transition-colors"
                    >
                        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeSidebar}
                        className="lg:hidden text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 w-8 h-8 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                </div>

                {/* Profile Widget - Premium Card Style */}
                {!isCollapsed && dbUser && (
                    <div className={cn(
                        "mx-3 sm:mx-5 mb-8 p-3.5 sm:p-4 rounded-2xl relative overflow-hidden group transition-all duration-300",
                        dbUser?.role === 'agent'
                            ? "bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 hover:border-yellow-300 dark:hover:border-yellow-500/40 shadow-sm dark:shadow-[0_0_30px_-5px_rgba(234,179,8,0.15)]"
                            : (dbUser?.role === 'dealer')
                                ? "bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 hover:border-purple-300 dark:hover:border-purple-500/40 shadow-sm dark:shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)]"
                                : "bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 shadow-sm dark:shadow-xl"
                    )}>
                        {/* Decorative Background Glows */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                        {dbUser?.role === 'agent' && (
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-yellow-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                        )}
                        {dbUser?.role === 'dealer' && (
                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity"></div>
                        )}

                        {/* User Info Row */}
                        <div className="flex items-center gap-3.5 mb-5 relative z-10">
                            {/* Avatar with Role Icon */}
                            <div
                                className="relative w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg backdrop-blur-sm border border-white/10"
                                style={{
                                    backgroundColor:
                                        dbUser?.role === 'agent' ? 'rgba(234,179,8,0.2)' :
                                            dbUser?.role === 'dealer' ? 'rgba(168,85,247,0.2)' :
                                                'rgba(255,255,255,0.1)'
                                }}
                            >
                                <RoleIcon className={cn(
                                    "w-6 h-6",
                                    dbUser?.role === 'agent' ? "text-yellow-400" :
                                        dbUser?.role === 'dealer' ? "text-purple-400" :
                                            "text-slate-200"
                                )} />
                                <div
                                    className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center bg-black border-[3px] border-black"
                                >
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse" />
                                </div>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5 flex-wrap drop-shadow-sm">
                                    {dbUser?.first_name} {dbUser?.last_name}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <span
                                        className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border",
                                            dbUser?.role === 'agent'
                                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                                : dbUser?.role === 'dealer'
                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                    : "bg-white/10 text-slate-300 border-white/10"
                                        )}
                                    >
                                        {currentRole.label}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Wallet Section */}
                        <div className={cn(
                            "flex items-center justify-between p-3.5 mt-4 rounded-xl backdrop-blur-md relative z-10",
                            dbUser?.role === 'agent'
                                ? "bg-white dark:bg-black/40 border border-yellow-200 dark:border-yellow-500/20"
                                : dbUser?.role === 'dealer'
                                    ? "bg-white dark:bg-black/40 border border-purple-200 dark:border-purple-500/20"
                                    : "bg-white dark:bg-black/60 border border-slate-200 dark:border-white/10"
                        )}>
                            <div>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-1">Balance</p>
                                <p className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center">
                                    <span className="text-sm font-bold text-slate-400 dark:text-slate-500 mr-1 mt-1">GH₵</span>
                                    {walletBalance.toFixed(2)}
                                </p>
                            </div>
                            {!(process.env.NEXT_PUBLIC_PAYMENT_MAINTENANCE_MODE === 'true' && !isAdmin) && isPageAccessible('/dashboard/wallet') && (
                                <Link href="/dashboard/wallet">
                                    <Button
                                        size="sm"
                                        className="h-9 px-3 text-xs font-bold gradient-primary hover:glow-primary text-white rounded-lg transition-all"
                                    >
                                        <Plus className="w-4 h-4 mr-1" />
                                        Top Up
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                )
                }

                {/* Navigation */}
                <nav className="px-3 pb-6 flex-1 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                    {!isCollapsed && (
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3 mt-2">
                            Main Menu
                        </p>
                    )}
                    <div className="space-y-1">
                        {userNavItems
                            .filter(item => {
                                // Admins see everything
                                if (isAdmin) return true

                                // For non-admin users, check page access settings
                                return isPageAccessible(item.href)
                            })
                            .map((item) => {
                                const isActive = isLinkActive(item.href)
                                return (
                                    <Link key={item.href} href={item.href} onClick={() => {
                                        if (window.innerWidth < 1024) closeSidebar()
                                    }}>                                        <div
                                            className={cn(
                                                "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative",
                                                isActive
                                                    ? dbUser?.role === 'agent'
                                                        ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 shadow-[0_0_15px_-3px_rgba(234,179,8,0.2)]"
                                                        : dbUser?.role === 'dealer'
                                                            ? "bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_-3px_rgba(168,85,247,0.2)]"
                                                            : "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-3px_rgba(225,0,255,0.2)]"
                                                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-transparent",
                                                isCollapsed && "justify-center px-0"
                                            )}
                                        >
                                            {isActive && !isCollapsed && (
                                                <div className={cn(
                                                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full shadow-lg",
                                                    dbUser?.role === 'dealer' ? "bg-purple-400 shadow-purple-400/50" : (dbUser?.role === 'agent' ? "bg-yellow-400 shadow-yellow-400/50" : "bg-primary shadow-primary/50")
                                                )}></div>
                                            )}
                                            <item.icon className={cn(
                                                "w-5 h-5 flex-shrink-0 transition-transform duration-300",
                                                isActive ? "" : "group-hover:scale-110",
                                                isActive && (dbUser?.role === 'dealer' ? "text-purple-400" : (dbUser?.role === 'agent' ? "text-yellow-400" : "text-primary"))
                                            )} />
                                            {!isCollapsed && <span className="text-sm font-semibold">{item.label}</span>}
                                        </div>
                                    </Link>
                                )
                            })}
                    </div>

                    {(isAdmin || isSubAdmin) && (
                        <>
                            {!isCollapsed && (
                                <div className="mt-8 mb-3 px-3 flex items-center gap-3">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        Admin Tools
                                    </p>
                                    <div className="flex-1 h-px bg-white/10"></div>
                                </div>
                            )}
                            <div className="space-y-1 mt-2">
                                {adminNavItems.filter(item => {
                                    if (isAdmin) return true
                                    if (isSubAdmin) return ['/admin/orders', '/admin/users'].includes(item.href)
                                    return false
                                }).map((item) => {
                                    const isActive = isLinkActive(item.href)
                                    return (
                                        <Link key={item.href} href={item.href} onClick={() => {
                                            if (window.innerWidth < 1024) closeSidebar()
                                        }}>
                                            <div
                                                className={cn(
                                                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 group relative",
                                                isActive
                                                    ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]"
                                                    : "text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:bg-indigo-500/5 dark:hover:bg-white/5 border border-transparent",
                                                isCollapsed && "justify-center px-0"
                                            )}
                                            >
                                                {isActive && !isCollapsed && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.6)]"></div>
                                                )}
                                                <item.icon className={cn(
                                                    "w-5 h-5 flex-shrink-0 transition-transform duration-300",
                                                    isActive ? "" : "group-hover:scale-110",
                                                    isActive && "text-indigo-400"
                                                )} />
                                                {!isCollapsed && <span className="text-sm font-semibold">{item.label}</span>}
                                            </div>
                                        </Link>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {/* Logout Button - Inside scrollable area */}
                    <div className="mt-8 px-3">
                        <Button
                            variant="ghost"
                            onClick={signOut}
                            className={cn(
                                "w-full justify-start text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/20 border border-transparent h-12 rounded-xl transition-all duration-300 group",
                                isCollapsed && "justify-center px-0"
                            )}
                        >
                            <LogOut className="w-5 h-5 transition-transform duration-300 group-hover:-translate-x-1" />
                            {!isCollapsed && <span className="ml-3 text-sm font-bold">Sign Out</span>}
                        </Button>
                    </div>
                </nav>
            </aside >
        </>
    )
}
