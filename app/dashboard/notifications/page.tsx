'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatRelativeTime } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NotificationIcon } from '@/components/notifications/notification-icon'
import { typesForCategory, CATEGORY_LABELS } from '@/lib/notification-meta'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import {
    Bell,
    CheckCircle2,
    Trash2,
    Check,
    Loader2,
    Trash,
    SlidersHorizontal,
    BellRing,
    ChevronDown,
} from 'lucide-react'
import { toast } from 'sonner'
import { isToday, isYesterday } from 'date-fns'
import type { Notification, NotificationCategory } from '@/types/supabase'

const PAGE_SIZE = 20
type Filter = 'all' | 'unread' | NotificationCategory

const FILTER_CHIPS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'order', label: CATEGORY_LABELS.order },
    { key: 'payment', label: CATEGORY_LABELS.payment },
    { key: 'security', label: CATEGORY_LABELS.security },
    { key: 'announcement', label: CATEGORY_LABELS.announcement },
    { key: 'marketing', label: CATEGORY_LABELS.marketing },
]

function dateGroup(dateStr: string): string {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Today'
    if (isYesterday(d)) return 'Yesterday'
    return 'Earlier'
}

export default function NotificationsPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()
    const router = useRouter()
    const { isSupported, isSubscribed, subscribe, isBusy } = usePushNotifications()

    const [notifications, setNotifications] = useState<Notification[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [hasMore, setHasMore] = useState(false)
    const [filter, setFilter] = useState<Filter>('all')
    const [unreadCount, setUnreadCount] = useState(0)
    const [markingAllRead, setMarkingAllRead] = useState(false)
    const [deletingAll, setDeletingAll] = useState(false)
    const [showPushCard, setShowPushCard] = useState(true)

    const applyFilter = useCallback((query: any, f: Filter) => {
        if (f === 'unread') return query.eq('is_read', false)
        if (f !== 'all') return query.in('type', typesForCategory(f))
        return query
    }, [])

    const fetchUnreadCount = useCallback(async () => {
        if (!dbUser) return
        const { count } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', dbUser.id as any)
            .eq('is_read', false)
        setUnreadCount(count || 0)
    }, [dbUser])

    const fetchPage = useCallback(
        async (reset: boolean) => {
            if (!dbUser) return
            const offset = reset ? 0 : notifications.length
            try {
                let query = supabase
                    .from('notifications')
                    .select('*')
                    .eq('user_id', dbUser.id as any)
                    .order('created_at', { ascending: false })
                    .range(offset, offset + PAGE_SIZE - 1)
                query = applyFilter(query, filter)

                const { data, error } = await query
                if (error) throw error
                const rows = (data as Notification[]) || []
                setNotifications((prev) => (reset ? rows : [...prev, ...rows]))
                setHasMore(rows.length === PAGE_SIZE)
            } catch (e) {
                console.error('Error fetching notifications:', e)
                toast.error('Failed to load notifications')
            }
        },
        [dbUser, filter, notifications.length, applyFilter],
    )

    // Initial + filter-change load
    useEffect(() => {
        if (isAuthLoading) return
        if (!dbUser) {
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        Promise.all([fetchPage(true), fetchUnreadCount()]).finally(() => setIsLoading(false))
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbUser, isAuthLoading, filter])

    // Realtime
    useEffect(() => {
        if (!dbUser) return
        const channel = supabase
            .channel(`notifications-page-${dbUser.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${dbUser.id}` },
                () => {
                    fetchPage(true)
                    fetchUnreadCount()
                },
            )
            .subscribe()
        return () => {
            supabase.removeChannel(channel)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dbUser, filter])

    const loadMore = async () => {
        setLoadingMore(true)
        await fetchPage(false)
        setLoadingMore(false)
    }

    const markAsRead = async (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
        setUnreadCount((c) => Math.max(0, c - 1))
        await (supabase.from('notifications') as any)
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', id)
    }

    const openNotification = (n: Notification) => {
        if (!n.is_read) markAsRead(n.id)
        if (n.action_url) router.push(n.action_url)
    }

    const markAllAsRead = async () => {
        if (!dbUser) return
        setMarkingAllRead(true)
        try {
            await (supabase.from('notifications') as any)
                .update({ is_read: true, read_at: new Date().toISOString() })
                .eq('user_id', dbUser.id as any)
                .eq('is_read', false)
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
            setUnreadCount(0)
            toast.success('All notifications marked as read')
        } catch {
            toast.error('Failed to mark all as read')
        } finally {
            setMarkingAllRead(false)
        }
    }

    const deleteNotification = async (id: string) => {
        const prev = notifications
        const wasUnread = notifications.find((n) => n.id === id && !n.is_read)
        setNotifications((p) => p.filter((n) => n.id !== id))
        if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1))
        const { error } = await (supabase.from('notifications') as any).delete().eq('id', id)
        if (error) {
            setNotifications(prev)
            toast.error('Failed to delete notification')
        }
    }

    const deleteAllNotifications = async () => {
        if (!dbUser) return
        setDeletingAll(true)
        try {
            const { error } = await (supabase.from('notifications') as any)
                .delete()
                .eq('user_id', dbUser.id as any)
            if (error) throw error
            setNotifications([])
            setUnreadCount(0)
            toast.success('All notifications deleted')
        } catch {
            toast.error('Failed to delete all notifications')
        } finally {
            setDeletingAll(false)
        }
    }

    const enablePush = async () => {
        const ok = await subscribe()
        if (ok) toast.success('Push notifications enabled!')
        else toast.error('Could not enable push notifications')
    }

    // Group the loaded notifications by day bucket (preserves order).
    const groups: { label: string; items: Notification[] }[] = []
    for (const n of notifications) {
        const label = dateGroup(n.created_at)
        const last = groups[groups.length - 1]
        if (last && last.label === label) last.items.push(n)
        else groups.push({ label, items: [n] })
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 rounded-2xl" />
                {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6 relative z-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Notifications</h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                        {unreadCount > 0 ? (
                            <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                {unreadCount} unread notification{unreadCount > 1 ? 's' : ''}
                            </span>
                        ) : (
                            'All caught up!'
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/notifications/preferences">
                        <Button variant="outline" size="sm" className="rounded-xl font-medium text-xs h-10 px-3">
                            <SlidersHorizontal className="w-4 h-4 sm:mr-2" />
                            <span className="hidden sm:inline">Settings</span>
                        </Button>
                    </Link>
                    {unreadCount > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={markAllAsRead}
                            disabled={markingAllRead}
                            className="rounded-xl font-medium text-xs h-10 px-3"
                        >
                            {markingAllRead ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Check className="w-4 h-4 sm:mr-2 text-primary" />}
                            <span className="hidden sm:inline">Mark all read</span>
                        </Button>
                    )}
                    {notifications.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={deleteAllNotifications}
                            disabled={deletingAll}
                            className="bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 hover:text-white hover:bg-rose-500 hover:border-rose-500 rounded-xl font-medium text-xs h-10 px-3 transition-all"
                        >
                            {deletingAll ? <Loader2 className="w-4 h-4 sm:mr-2 animate-spin" /> : <Trash className="w-4 h-4 sm:mr-2" />}
                            <span className="hidden sm:inline">Delete all</span>
                        </Button>
                    )}
                </div>
            </div>

            {/* Push opt-in card */}
            {isSupported && !isSubscribed && showPushCard && (
                <div className="glass-card rounded-2xl p-4 border border-primary/20 bg-primary/[0.04] flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <BellRing className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-foreground">Turn on push notifications</p>
                            <p className="text-xs font-medium text-foreground/55">Get instant alerts even when the app is closed.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <Button size="sm" onClick={enablePush} disabled={isBusy} className="rounded-xl font-medium text-xs h-9">
                            {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enable'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setShowPushCard(false)} className="rounded-xl font-medium text-xs h-9 text-foreground/50">
                            Later
                        </Button>
                    </div>
                </div>
            )}

            {/* Filter chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {FILTER_CHIPS.map((chip) => (
                    <button
                        key={chip.key}
                        onClick={() => setFilter(chip.key)}
                        className={`whitespace-nowrap rounded-lg text-xs font-medium px-3.5 h-8 transition-all border ${
                            filter === chip.key
                                ? 'bg-primary text-white border-transparent shadow-sm'
                                : 'bg-slate-50/50 dark:bg-black/40 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border-slate-200 dark:border-white/10'
                        }`}
                    >
                        {chip.label}
                        {chip.key === 'unread' && unreadCount > 0 && ` (${unreadCount})`}
                    </button>
                ))}
            </div>

            {/* List */}
            {notifications.length === 0 ? (
                <div className="glass-card p-12 text-center rounded-[2rem] border-slate-200 dark:border-white/5 flex flex-col items-center justify-center bg-white/50 dark:bg-black/40">
                    <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6">
                        <Bell className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No Notifications</h3>
                    <p className="text-slate-500 dark:text-slate-400">
                        {filter === 'all' ? "You don't have any notifications yet." : 'Nothing here for this filter.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {groups.map((group) => (
                        <div key={group.label} className="space-y-3">
                            <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 px-1">{group.label}</p>
                            {group.items.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`glass-card p-4 sm:p-5 rounded-2xl relative overflow-hidden group transition-all duration-300 bg-white/50 dark:bg-black/40 hover:bg-white dark:hover:bg-black/60 shadow-sm hover:shadow-xl ${
                                        !notification.is_read
                                            ? 'border-primary/30 dark:border-primary/30'
                                            : 'border-slate-100 dark:border-white/5 opacity-95'
                                    }`}
                                >
                                    {!notification.is_read && (
                                        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500" />
                                    )}
                                    <div className="flex items-start gap-3 sm:gap-4 pl-1 sm:pl-2">
                                        <div
                                            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${
                                                !notification.is_read
                                                    ? 'bg-primary/10 dark:bg-primary/20 border-primary/20 dark:border-primary/30'
                                                    : 'bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/5'
                                            }`}
                                        >
                                            <NotificationIcon type={notification.type} className="w-[18px] h-[18px]" />
                                        </div>
                                        <button onClick={() => openNotification(notification)} className="flex-1 min-w-0 text-left">
                                            <h3 className={`text-sm sm:text-[15px] font-semibold tracking-tight ${!notification.is_read ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                                {notification.title}
                                            </h3>
                                            <p className={`text-[13px] sm:text-sm font-normal leading-relaxed mt-0.5 break-words ${!notification.is_read ? 'text-slate-600 dark:text-slate-400' : 'text-slate-500 dark:text-slate-500'}`}>
                                                {notification.message}
                                            </p>
                                            <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 pt-1.5">
                                                {formatRelativeTime(notification.created_at)}
                                            </p>
                                        </button>
                                        <div className="flex items-center gap-1 self-start">
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
                            ))}
                        </div>
                    ))}

                    {hasMore && (
                        <div className="flex justify-center pt-2">
                            <Button
                                variant="outline"
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="rounded-xl font-medium text-xs h-10 px-6"
                            >
                                {loadingMore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                                Load more
                            </Button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
