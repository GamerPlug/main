'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DEFAULT_PREFS, type PrefKey } from '@/lib/notification-meta'
import {
    ArrowLeft,
    ShoppingCart,
    Wallet,
    ShieldCheck,
    Megaphone,
    Tag,
    BellRing,
    Loader2,
    Send,
    type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'

interface CategoryRow {
    key: PrefKey
    icon: LucideIcon
    title: string
    description: string
}

const CATEGORY_ROWS: CategoryRow[] = [
    { key: 'order_updates', icon: ShoppingCart, title: 'Order updates', description: 'Order received, processing, completed and failed alerts' },
    { key: 'payments', icon: Wallet, title: 'Payments & wallet', description: 'Top-ups, refunds, balance changes and low-balance warnings' },
    { key: 'security', icon: ShieldCheck, title: 'Account & security', description: 'Login alerts, role changes, suspensions and API keys' },
    { key: 'announcements', icon: Megaphone, title: 'Announcements', description: 'Important platform-wide messages from the team' },
    { key: 'marketing', icon: Tag, title: 'Promotions', description: 'Price drops, new packages and special offers' },
]

export default function NotificationPreferencesPage() {
    const { dbUser, isLoading: authLoading } = useAuth()
    const { isSupported, permission, isSubscribed, isBusy, subscribe, unsubscribe } = usePushNotifications()
    const [prefs, setPrefs] = useState<typeof DEFAULT_PREFS>({ ...DEFAULT_PREFS })
    const [loading, setLoading] = useState(true)
    const [testing, setTesting] = useState(false)

    useEffect(() => {
        if (authLoading) return
        if (!dbUser) {
            setLoading(false)
            return
        }
        ;(async () => {
            const { data } = await supabase
                .from('notification_preferences')
                .select('order_updates, payments, security, announcements, marketing, push_enabled')
                .eq('user_id', dbUser.id as any)
                .maybeSingle()
            if (data) setPrefs({ ...DEFAULT_PREFS, ...(data as any) })
            setLoading(false)
        })()
    }, [dbUser, authLoading])

    const persist = async (next: typeof DEFAULT_PREFS) => {
        if (!dbUser) return
        const { error } = await (supabase.from('notification_preferences') as any).upsert(
            { user_id: dbUser.id, ...next, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' },
        )
        if (error) {
            toast.error('Failed to save preference')
            return false
        }
        return true
    }

    const toggleCategory = async (key: PrefKey) => {
        const next = { ...prefs, [key]: !prefs[key] }
        setPrefs(next)
        const ok = await persist(next)
        if (ok) toast.success('Preference saved')
    }

    const togglePush = async (enabled: boolean) => {
        // Reflect optimistically, then drive the browser subscription.
        setPrefs((p) => ({ ...p, push_enabled: enabled }))
        if (enabled) {
            const ok = await subscribe()
            if (!ok) {
                setPrefs((p) => ({ ...p, push_enabled: false }))
                toast.error(
                    permission === 'denied'
                        ? 'Notifications are blocked in your browser settings.'
                        : 'Could not enable push notifications.',
                )
                return
            }
            await persist({ ...prefs, push_enabled: true })
            toast.success('Push notifications enabled')
        } else {
            await unsubscribe()
            await persist({ ...prefs, push_enabled: false })
            toast.success('Push notifications disabled')
        }
    }

    const sendTest = async () => {
        setTesting(true)
        try {
            const res = await fetch('/api/push/test', { method: 'POST' })
            const json = await res.json()
            if (res.ok && json.sent > 0) toast.success('Test notification sent!')
            else if (res.ok) toast.message('No active devices to push to. Enable push first.')
            else toast.error(json.error || 'Failed to send test')
        } catch {
            toast.error('Failed to send test')
        } finally {
            setTesting(false)
        }
    }

    if (loading) {
        return (
            <div className="space-y-4 max-w-2xl">
                <Skeleton className="h-10 w-48 rounded-xl" />
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-2xl relative z-10">
            <div>
                <Link href="/dashboard/notifications" className="inline-flex items-center gap-1.5 text-sm font-bold text-foreground/60 hover:text-foreground transition-colors mb-3">
                    <ArrowLeft className="w-4 h-4" /> Back to notifications
                </Link>
                <h1 className="text-3xl font-black text-foreground tracking-tight">Notification Settings</h1>
                <p className="text-sm font-semibold text-foreground/55 mt-1">Choose what you get notified about and how.</p>
            </div>

            {/* Push master card */}
            <div className="glass-card rounded-2xl p-5 border border-border/60 bg-card/50">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <BellRing className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-base font-black text-foreground">Push notifications</p>
                            <p className="text-xs font-medium text-foreground/55 mt-0.5 max-w-sm">
                                Get instant alerts on this device even when Gamer Plug is closed.
                            </p>
                            {!isSupported && (
                                <p className="text-xs font-bold text-amber-600 dark:text-amber-500 mt-2">
                                    Not supported on this browser. On iPhone/iPad, install the app to your Home Screen first.
                                </p>
                            )}
                            {isSupported && permission === 'denied' && (
                                <p className="text-xs font-bold text-rose-600 dark:text-rose-500 mt-2">
                                    Blocked. Enable notifications in your browser site settings.
                                </p>
                            )}
                        </div>
                    </div>
                    <Switch
                        checked={isSubscribed && prefs.push_enabled}
                        onCheckedChange={togglePush}
                        disabled={!isSupported || isBusy || permission === 'denied'}
                    />
                </div>
                {isSupported && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={sendTest}
                            disabled={testing || !isSubscribed}
                            className="rounded-xl font-bold text-xs h-9"
                        >
                            {testing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                            Send test notification
                        </Button>
                    </div>
                )}
            </div>

            {/* Category toggles */}
            <div className="glass-card rounded-2xl border border-border/60 bg-card/50 divide-y divide-border/50 overflow-hidden">
                {CATEGORY_ROWS.map(({ key, icon: Icon, title, description }) => (
                    <div key={key} className="flex items-center justify-between gap-4 p-5">
                        <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-muted border border-border/50 flex items-center justify-center flex-shrink-0">
                                <Icon className="w-5 h-5 text-foreground/70" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground">{title}</p>
                                <p className="text-xs font-medium text-foreground/55 mt-0.5 max-w-sm">{description}</p>
                            </div>
                        </div>
                        <Switch checked={prefs[key]} onCheckedChange={() => toggleCategory(key)} />
                    </div>
                ))}
            </div>

            <p className="text-xs text-foreground/40 font-medium px-1">
                Critical account and security alerts may still be delivered regardless of these settings.
            </p>
        </div>
    )
}
