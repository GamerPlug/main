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
import { Menu, Sun, Moon, Bell, User, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'

export function DashboardHeader() {
    const { dbUser, signOut, isAdmin, isSubAdmin } = useAuth()
    const { toggleSidebar } = useUI()
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [unreadCount, setUnreadCount] = useState(0)

    // Avoid hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (dbUser) {
            fetchUnreadNotifications()
        }
    }, [dbUser])

    const fetchUnreadNotifications = async () => {
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', dbUser?.id as any)
            .eq('is_read', false)

        setUnreadCount(count || 0)
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
        <header className={cn(
            "sticky top-0 z-40 h-16 backdrop-blur-xl border-b transition-all duration-300",
            dbUser?.role === 'agent'
                ? "bg-yellow-50 dark:bg-card border-yellow-200/60 dark:border-border shadow-sm"
                : "bg-white dark:bg-card border-border shadow-sm"
        )}>
            <div className="h-full px-4 lg:px-8 flex items-center justify-between">
                {/* Mobile Menu Button */}
                <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden text-slate-500 dark:text-slate-300 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 transition-colors"
                    onClick={toggleSidebar}
                >
                    <Menu className="w-5 h-5" />
                </Button>

                {/* Welcome Message */}
                <div className="hidden lg:block">
                    <h1 className="text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:to-white/60 drop-shadow-sm flex items-center gap-2">
                        Welcome back, {dbUser?.first_name || 'User'}!
                        <span className="text-xl animate-bounce origin-bottom inline-block">👋</span>
                    </h1>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                        Here's what's happening with your account
                    </p>
                </div>

                {/* Right Side Actions */}
                <div className="flex items-center gap-3">
                    {/* Theme Toggle */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 transition-colors h-10 w-10 rounded-full"
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

                    {/* Notifications */}
                    <Link href="/dashboard/notifications">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="relative text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 transition-colors h-10 w-10 rounded-full"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className={cn(
                                    "absolute top-1.5 right-1.5 w-4 h-4 text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 shadow-md",
                                    dbUser?.role === 'agent'
                                        ? "bg-yellow-500 text-black animate-pulse"
                                        : "bg-primary text-white animate-pulse"
                                )}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </Button>
                    </Link>

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
                                    <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">
                                        {dbUser?.first_name} {dbUser?.last_name}
                                    </p>
                                    <p className="text-xs leading-none text-slate-400 font-medium">
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
                                <DropdownMenuItem className="focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer py-2.5 transition-colors">
                                    <User className="mr-3 h-4 w-4" />
                                    <span className="font-medium">Profile Details</span>
                                </DropdownMenuItem>
                            </Link>
                            {isAdmin && (
                                <Link href="/admin/settings">
                                    <DropdownMenuItem className="focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer py-2.5 transition-colors mt-1">
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
