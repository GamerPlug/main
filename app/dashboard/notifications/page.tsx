'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Bell,
    CheckCircle2,
    ShoppingCart,
    CreditCard,
    MessageSquare,
    Wallet,
    Trash2,
    Check,
    AlertCircle,
    Loader2,
    Trash
} from 'lucide-react'
import { toast } from 'sonner'
import { Notification } from '@/types/supabase'

export default function NotificationsPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [markingAllRead, setMarkingAllRead] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) {
                fetchNotifications()
            } else {
                setIsLoading(false)
            }
        }
    }, [dbUser, isAuthLoading])

    // Real-time subscription for live notification updates
    useEffect(() => {
        if (!dbUser) return

        const channel = supabase
            .channel(`notifications-${dbUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchNotifications()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dbUser])

    const fetchNotifications = async () => {
        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })

            if (error) throw error
            setNotifications(data || [])
        } catch (error) {
            console.error('Error fetching notifications:', error)
            toast.error('Failed to load notifications')
        } finally {
            setIsLoading(false)
        }
    }

    const markAsRead = async (id: string) => {
        try {
            await (supabase
                .from('notifications') as any)
                .update({ is_read: true })
                .eq('id', id)

            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            )
        } catch (error) {
            toast.error('Failed to mark as read')
        }
    }

    const markAllAsRead = async () => {
        setMarkingAllRead(true)
        try {
            await (supabase
                .from('notifications') as any)
                .update({ is_read: true })
                .eq('user_id', dbUser?.id as any)
                .eq('is_read', false)

            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
            toast.success('All notifications marked as read')
        } catch (error) {
            toast.error('Failed to mark all as read')
        } finally {
            setMarkingAllRead(false)
        }
    }

    const deleteNotification = async (id: string) => {
        try {
            await (supabase
                .from('notifications') as any)
                .delete()
                .eq('id', id)

            setNotifications(prev => prev.filter(n => n.id !== id))
            toast.success('Notification deleted')
        } catch (error) {
            toast.error('Failed to delete notification')
        }
    }

    const deleteAllNotifications = async () => {
        setDeletingAll(true)
        try {
            await (supabase
                .from('notifications') as any)
                .delete()
                .eq('user_id', dbUser?.id as any)

            setNotifications([])
            toast.success('All notifications deleted')
        } catch (error) {
            toast.error('Failed to delete all notifications')
        } finally {
            setDeletingAll(false)
        }
    }

    const getIcon = (type: string) => {
        switch (type) {
            case 'order_update':
                return <ShoppingCart className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            case 'payment_success':
                return <CreditCard className="w-5 h-5 text-green-600 dark:text-green-500" />
            case 'complaint_resolved':
                return <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-500" />
            case 'balance_updated':
                return <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-500" />
            default:
                return <Bell className="w-5 h-5 text-slate-500" />
        }
    }

    const filteredNotifications = filter === 'unread'
        ? notifications.filter(n => !n.is_read)
        : notifications

    const unreadCount = notifications.filter(n => !n.is_read).length

    if (isLoading) {
        return (
            <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6 lg:space-y-8 relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Notifications</h1>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                        {unreadCount > 0 ? (
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                                {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                            </span>
                        ) : 'All caught up!'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={markAllAsRead}
                            disabled={markingAllRead}
                            className="bg-slate-50/50 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl font-bold text-xs h-10 px-4 transition-all"
                        >
                            {markingAllRead ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Check className="w-4 h-4 sm:mr-2 text-primary" />}
                            <span className="hidden sm:inline">Mark all as read</span>
                            <span className="sm:hidden">Mark read</span>
                        </Button>
                    )}
                    {notifications.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={deleteAllNotifications}
                            disabled={deletingAll}
                            className="bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-500 hover:border-rose-500 rounded-xl font-bold text-xs h-10 px-4 transition-all"
                        >
                            {deletingAll ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Trash className="w-4 h-4 sm:mr-2" />}
                            <span className="hidden sm:inline">Delete All</span>
                            <span className="sm:hidden">Delete</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 p-1.5 glass-card rounded-2xl w-fit border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/40 backdrop-blur-md shadow-inner">
                <Button
                    variant={filter === 'all' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className={`rounded-xl text-xs font-bold px-5 h-9 transition-all ${filter === 'all' ? 'gradient-primary text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    All ({notifications.length})
                </Button>
                <Button
                    variant={filter === 'unread' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('unread')}
                    className={`rounded-xl text-xs font-bold px-5 h-9 transition-all ${filter === 'unread' ? 'bg-slate-200/50 dark:bg-white/20 text-slate-900 dark:text-white shadow-lg border border-slate-300 dark:border-white/10' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                >
                    Unread ({unreadCount})
                </Button>
            </div>

            {/* Notifications List */}
            {filteredNotifications.length === 0 ? (
                <div className="glass-card p-12 text-center rounded-[2rem] border-slate-200 dark:border-white/5 flex flex-col items-center justify-center bg-white/50 dark:bg-black/40 shadow-sm dark:shadow-xl">
                    <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6 shadow-inner">
                        <Bell className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">No Notifications</h3>
                    <p className="text-slate-500 dark:text-slate-400">
                        {filter === 'unread' ? "You've read all your notifications!" : "You don't have any notifications yet."}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredNotifications.map((notification) => (
                        <div
                            key={notification.id}
                            className={`glass-card p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 bg-white/50 dark:bg-black/40 backdrop-blur-md hover:bg-white dark:hover:bg-black/60 shadow-sm hover:shadow-xl ${!notification.is_read
                                ? 'border-primary/30 dark:border-primary/30 shadow-[0_0_20px_rgba(225,0,255,0.1)] dark:shadow-[0_0_20px_rgba(225,0,255,0.1)]'
                                : 'border-slate-100 dark:border-white/5 opacity-90'
                                }`}
                        >
                            {!notification.is_read && (
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500 shadow-[0_0_10px_rgba(225,0,255,0.5)]"></div>
                            )}

                            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6 pl-2 sm:pl-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-inner ${!notification.is_read ? 'bg-primary/10 dark:bg-primary/20 border border-primary/20 dark:border-primary/30' : 'bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5'
                                    }`}>
                                    <div className={`${notification.is_read ? 'opacity-60' : 'drop-shadow-[0_0_8px_rgba(225,0,255,0.3)]'}`}>
                                        {getIcon(notification.type)}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <h3 className={`text-base font-black tracking-tight ${!notification.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {notification.title}
                                            </h3>
                                            <p className={`text-sm font-medium leading-relaxed ${!notification.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                                {notification.message}
                                            </p>
                                            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-1">
                                                {formatDate(notification.created_at)}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2 self-end sm:self-start">
                                            {!notification.is_read && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                                                    onClick={() => markAsRead(notification.id)}
                                                    title="Mark as read"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </Button>
                                            )}
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="w-8 h-8 rounded-full text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                                onClick={() => deleteNotification(notification.id)}
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
