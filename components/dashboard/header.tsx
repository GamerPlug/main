'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useUI } from '@/contexts/ui-context'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { roleConfig } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { Menu, Sun, Moon, Bell, User, Settings, LogOut, CheckCheck, ArrowRight, SlidersHorizontal } from 'lucide-react'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { NotificationIcon } from '@/components/notifications/notification-icon'
import { NotificationBell } from '@/components/notifications/notification-bell'
import { ContactMenu } from '@/components/dashboard/contact-menu'
import type { Notification } from '@/types/supabase'
import { useRouter } from 'next/navigation'

export function DashboardHeader() {
    const { dbUser, signOut, isAdmin, isSubAdmin } = useAuth()
    const { toggleSidebar } = useUI()
    const { theme, setTheme } = useTheme()
    const router = useRouter()
    const [mounted, setMounted] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)
    const [recent, setRecent] = useState<Notification[]>([])

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (dbUser) {
            fetchNotifications()
        }
    }, [dbUser])

    // Live updates: keep the badge + preview fresh and surface a toast on arrival.
    useEffect(() => {
        if (!dbUser) return
        const channel = supabase
            .channel(`header-notifications-${dbUser.id}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${dbUser.id}` },
                (payload) => {
                    const n = payload.new as Notification
                    toast(n.title, {
                        description: n.message,
                        action: n.action_url
                            ? { label: 'View', onClick: () => router.push(n.action_url as string) }
                            : undefined,
                    })
                    fetchNotifications()
                },
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${dbUser.id}` },
                () => fetchNotifications(),
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbUser])

    const fetchNotifications = async () => {
        if (!dbUser) return
        const [{ count }, { data }] = await Promise.all([
            supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', dbUser.id as any)
                .eq('is_read', false),
            supabase
                .from('notifications')
                .select('*')
                .eq('user_id', dbUser.id as any)
                .order('created_at', { ascending: false })
                .limit(6),
        ])
        setUnreadCount(count || 0)
        setRecent((data as Notification[]) || [])
    }

    const markAllRead = async () => {
        if (!dbUser) return
        await (supabase.from('notifications') as any)
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', dbUser.id as any)
            .eq('is_read', false)
        setUnreadCount(0)
        setRecent((prev) => prev.map((n) => ({ ...n, is_read: true })))
    }

    const openNotification = async (n: Notification) => {
        if (!n.is_read) {
            await (supabase.from('notifications') as any)
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('id', n.id)
        }
        router.push(n.action_url || '/dashboard/notifications')
    }

    const getInitials = () => {
        if (!dbUser) return 'U'
        return `${dbUser.first_name?.[0] || ''}${dbUser.last_name?.[0] || ''}`.toUpperCase()
    }

    // Get role config
    const userRole = isAdmin ? 'admin' : (dbUser?.role || 'agent') as keyof typeof roleConfig
    const currentRole = roleConfig[userRole] || roleConfig['agent']
    const RoleIcon = currentRole.icon

    return (
        <header className="sticky top-0 z-40 h-16 bg-background border-b border-border shadow-sm">
            <div className="h-full px-4 lg:px-8 flex items-center justify-between">
                {/* Mobile Menu Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden text-foreground/70 hover:text-foreground hover:bg-muted transition-colors"
                    onClick={toggleSidebar}
                >
                    <Menu className="w-5 h-5" />
                </Button>

                {/* Welcome Message */}
                <div className="hidden lg:block">
                    <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                        Welcome back, {dbUser?.first_name || 'User'}!
                    </h1>
                    <p className="text-xs font-medium text-foreground/60 mt-0.5">
                        Here's what's happening with your account
                    </p>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-foreground/60 hover:text-foreground hover:bg-muted transition-colors h-10 w-10 rounded-full"
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    >
                        {mounted && (theme === 'dark' ? (
                            <Sun className="w-5 h-5 animate-in zoom-in spin-in-90 duration-500" />
                        ) : (
                            <Moon className="w-5 h-5 animate-in zoom-in spin-in-90 duration-500" />
                        ))}
                        <span className="sr-only">Toggle theme</span>
                    </Button>

                    {/* Role Badge */}
                    <Badge
                        className="hidden sm:flex text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 border backdrop-blur-md shadow-sm"
                        style={{
                            backgroundColor: `${currentRole.color}20`, // 20% opacity hex equivalent
                            color: currentRole.color,
                            borderColor: `${currentRole.color}40`
                        }}
                    >
                        {currentRole.label}
                    </Badge>

                    {/* Contact / Support */}
                    <ContactMenu />

                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative text-foreground/60 hover:text-foreground hover:bg-muted transition-colors h-10 w-10 rounded-full"
                            >
                                <NotificationBell count={unreadCount} />
                                <span className="sr-only">Notifications</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-[22rem] glass-card border-white/10 mt-2 p-0 overflow-hidden" align="end" forceMount>
                            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
                                <p className="text-sm font-black text-foreground">
                                    Notifications {unreadCount > 0 && <span className="text-primary">({unreadCount})</span>}
                                </p>
                                <div className="flex items-center gap-1">
                                    {unreadCount > 0 && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 rounded-lg text-foreground/60 hover:text-foreground"
                                            onClick={markAllRead}
                                            title="Mark all as read"
                                        >
                                            <CheckCheck className="w-4 h-4" />
                                        </Button>
                                    )}
                                    <Link href="/dashboard/notifications/preferences" title="Notification settings">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-foreground/60 hover:text-foreground">
                                            <SlidersHorizontal className="w-4 h-4" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>

                            <div className="max-h-[22rem] overflow-y-auto">
                                {recent.length === 0 ? (
                                    <div className="px-4 py-10 text-center">
                                        <Bell className="w-8 h-8 text-foreground/20 mx-auto mb-2" />
                                        <p className="text-sm font-medium text-foreground/50">You're all caught up</p>
                                    </div>
                                ) : (
                                    recent.map((n) => (
                                        <button
                                            key={n.id}
                                            onClick={() => openNotification(n)}
                                            className={cn(
                                                'w-full text-left flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/60 transition-colors',
                                                !n.is_read && 'bg-primary/[0.04]'
                                            )}
                                        >
                                            <div className={cn(
                                                'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border',
                                                !n.is_read ? 'bg-primary/10 border-primary/20' : 'bg-muted border-border/50'
                                            )}>
                                                <NotificationIcon type={n.type} className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={cn('text-[13px] leading-snug truncate', !n.is_read ? 'font-bold text-foreground' : 'font-semibold text-foreground/80')}>
                                                    {n.title}
                                                </p>
                                                <p className="text-xs text-foreground/55 line-clamp-2 leading-snug mt-0.5">{n.message}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/35 mt-1">{formatRelativeTime(n.created_at)}</p>
                                            </div>
                                            {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />}
                                        </button>
                                    ))
                                )}
                            </div>

                            <Link href="/dashboard/notifications" className="block">
                                <div className="px-4 py-3 text-center text-xs font-bold text-primary hover:bg-muted/60 transition-colors flex items-center justify-center gap-1.5">
                                    See all notifications <ArrowRight className="w-3.5 h-3.5" />
                                </div>
                            </Link>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="relative h-10 w-10 rounded-full ml-1">
                                <Avatar className="h-10 w-10 ring-2 ring-white/10 hover:ring-white/30 transition-all hover:scale-105 active:scale-95 shadow-lg">
                                    <AvatarFallback
                                        className="text-white font-bold flex items-center justify-center"
                                        style={{ backgroundColor: `${currentRole.color}90` }}
                                    >
                                        <RoleIcon className="w-5 h-5 drop-shadow-md" />
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 glass-card border-white/10 mt-2 p-2" align="end" forceMount>
                            <DropdownMenuLabel className="font-normal p-3">
                                <div className="flex flex-col space-y-2">
                                    <p className="text-sm font-bold text-foreground leading-none">
                                        {dbUser?.first_name} {dbUser?.last_name}
                                    </p>
                                    <p className="text-xs leading-none text-foreground/60 font-medium">
                                        {dbUser?.email}
                                    </p>
                                    <Badge
                                        className="w-fit mt-2 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 border"
                                        style={{
                                            backgroundColor: `${currentRole.color}20`,
                                            color: currentRole.color,
                                            borderColor: `${currentRole.color}40`
                                        }}
                                    >
                                        {isAdmin ? 'Admin' : dbUser?.role === 'dealer' ? 'Dealer' : 'Agent'}
                                    </Badge>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10 my-1" />
                            <Link href="/dashboard/profile">
                                <DropdownMenuItem className="focus:bg-muted focus:text-foreground text-foreground/70 rounded-lg cursor-pointer py-2.5 transition-colors">
                                    <User className="mr-3 h-4 w-4" />
                                    <span className="font-medium">Profile Details</span>
                                </DropdownMenuItem>
                            </Link>
                            {isAdmin && (
                                <Link href="/admin/settings">
                                    <DropdownMenuItem className="focus:bg-muted focus:text-foreground text-foreground/70 rounded-lg cursor-pointer py-2.5 transition-colors mt-1">
                                        <Settings className="mr-3 h-4 w-4" />
                                        <span className="font-medium">Admin Settings</span>
                                    </DropdownMenuItem>
                                </Link>
                            )}
                            <DropdownMenuSeparator className="bg-white/10 my-1" />
                            <DropdownMenuItem
                                onClick={signOut}
                                className="focus:bg-red-500/20 focus:text-red-400 text-red-500 rounded-lg cursor-pointer py-2.5 transition-colors group mt-1"
                            >
                                <LogOut className="mr-3 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-bold">Log out Securely</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </header >
    )
}
