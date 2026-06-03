'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { roleConfig } from '@/lib/roles'
import { usePageAccess } from '@/hooks/use-page-access'
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
    LogOut,
    Settings,
    Shield,
    Code2,
    Key,
    Zap,
    CreditCard,
} from 'lucide-react'

const workspaceNavItems = [
    { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/dashboard/data-packages', label: 'Data Bundles', icon: Package },
    { href: '/dashboard/my-orders', label: 'My Orders', icon: ShoppingCart },
    { href: '/dashboard/wallet', label: 'Wallet', icon: Wallet },
    { href: '/dashboard/developer', label: 'API', icon: Code2 },
    { href: '/dashboard/complaints', label: 'Support', icon: MessageSquare },
]

const quickNavItems = [
    { href: '/dashboard/notifications', label: 'Notifications', icon: Bell },
    { href: '/dashboard/profile', label: 'Profile', icon: User },
]

const adminNavItems = [
    { href: '/admin', label: 'Dashboard', icon: Shield },
    { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
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

// Defined outside the parent so React never unmounts/remounts it on re-renders.
// Defining a component inside another component gives it a new reference each
// render, which causes React to treat it as a different component — breaking
// touch events and causing the double-press bug on mobile.
interface NavItemProps {
    href: string
    label: string
    icon: React.ElementType
    isActive: boolean
    onNavigate: () => void
}

function NavItem({ href, label, icon: Icon, isActive, onNavigate }: NavItemProps) {
    return (
        <Link href={href} onClick={onNavigate}>
            <div className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                isActive
                    ? "bg-muted text-foreground border border-border font-semibold"
                    : "text-foreground/70 hover:bg-muted hover:text-foreground font-normal"
            )}>
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
            </div>
        </Link>
    )
}

export function DashboardSidebar() {
    const pathname = usePathname()
    const { dbUser, isAdmin, signOut } = useAuth()
    const { isInternalSidebarOpen, closeSidebar } = useUI()
    const { isPageAccessible } = usePageAccess()

    const isLinkActive = (href: string) => {
        if (href === '/dashboard' || href === '/admin') {
            return pathname === href
        }
        return pathname?.startsWith(href) ?? false
    }

    const resolvedRole = (isAdmin ? 'admin' : (dbUser?.role ?? 'agent')) as keyof typeof roleConfig
    const currentRole = roleConfig[resolvedRole] ?? roleConfig['agent']

    const initials = dbUser
        ? `${dbUser.first_name?.[0] ?? ''}${dbUser.last_name?.[0] ?? ''}`.toUpperCase()
        : ''

    return (
        <>
            {/* Mobile overlay */}
            {isInternalSidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                    onClick={closeSidebar}
                />
            )}

            <aside className={cn(
                "fixed left-0 top-0 z-50 h-full flex flex-col bg-background border-r border-border w-[260px] transition-transform duration-300",
                isInternalSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}>

                {/* Header */}
                <div className="flex items-center gap-3 px-5 pt-6 pb-5">
                    <Link href="/dashboard" className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="relative w-8 h-8 flex-shrink-0">
                            <Image
                                src="/logo.png"
                                alt="GAMER PLUG"
                                fill
                                className="object-contain"
                                priority
                            />
                        </div>
                        <span className="text-sm font-bold tracking-wide text-foreground font-orbitron truncate">
                            GAMER PLUG
                        </span>
                    </Link>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-foreground text-background uppercase tracking-wider flex-shrink-0">
                        {currentRole.label}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={closeSidebar}
                        className="lg:hidden w-7 h-7 flex-shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">

                    {/* Workspace */}
                    <div>
                        <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-widest px-3 mb-1.5">
                            Workspace
                        </p>
                        <div className="space-y-0.5">
                            {workspaceNavItems
                                .filter(item => isAdmin || isPageAccessible(item.href))
                                .map(item => (
                                    <NavItem
                                        key={item.href}
                                        href={item.href}
                                        label={item.label}
                                        icon={item.icon}
                                        isActive={isLinkActive(item.href)}
                                        onNavigate={closeSidebar}
                                    />
                                ))}
                        </div>
                    </div>

                    {/* Quick */}
                    <div>
                        <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-widest px-3 mb-1.5">
                            Quick
                        </p>
                        <div className="space-y-0.5">
                            {quickNavItems
                                .filter(item => isAdmin || isPageAccessible(item.href))
                                .map(item => (
                                    <NavItem
                                        key={item.href}
                                        href={item.href}
                                        label={item.label}
                                        icon={item.icon}
                                        isActive={isLinkActive(item.href)}
                                        onNavigate={closeSidebar}
                                    />
                                ))}
                        </div>
                    </div>

                    {/* Admin tools */}
                    {isAdmin && (
                        <div>
                            <p className="text-[10px] font-semibold text-foreground/60 uppercase tracking-widest px-3 mb-1.5">
                                Admin
                            </p>
                            <div className="space-y-0.5">
                                {adminNavItems.map(item => (
                                    <NavItem
                                        key={item.href}
                                        href={item.href}
                                        label={item.label}
                                        icon={item.icon}
                                        isActive={isLinkActive(item.href)}
                                        onNavigate={closeSidebar}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </nav>

                {/* Bottom profile strip */}
                {dbUser && (
                    <div className="border-t border-border px-4 py-3.5 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate leading-tight">
                                {dbUser.first_name} {dbUser.last_name}
                            </p>
                            <p className="text-xs text-foreground/60 truncate leading-tight mt-0.5">
                                {dbUser.phone_number}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={signOut}
                            className="w-8 h-8 text-foreground/60 hover:text-destructive flex-shrink-0"
                            title="Sign out"
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </aside>
        </>
    )
}
