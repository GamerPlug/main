import {
    ShoppingCart,
    CheckCircle2,
    XCircle,
    Loader2,
    CreditCard,
    Wallet,
    RotateCcw,
    AlertTriangle,
    ShieldAlert,
    ShieldCheck,
    KeyRound,
    UserCog,
    MessageSquare,
    Megaphone,
    Tag,
    Package,
    Bell,
    LogIn,
    Lock,
    Clock,
    type LucideIcon,
} from 'lucide-react'

interface Visual {
    Icon: LucideIcon
    color: string // text color class
}

const TYPE_VISUAL: Record<string, Visual> = {
    order_placed: { Icon: ShoppingCart, color: 'text-blue-600 dark:text-blue-500' },
    order_processing: { Icon: Clock, color: 'text-blue-500 dark:text-blue-400' },
    order_completed: { Icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-500' },
    order_failed: { Icon: XCircle, color: 'text-rose-600 dark:text-rose-500' },
    order_update: { Icon: ShoppingCart, color: 'text-blue-600 dark:text-blue-500' },

    payment_success: { Icon: CreditCard, color: 'text-emerald-600 dark:text-emerald-500' },
    refund_issued: { Icon: RotateCcw, color: 'text-emerald-600 dark:text-emerald-500' },
    balance_credited: { Icon: Wallet, color: 'text-emerald-600 dark:text-emerald-500' },
    balance_debited: { Icon: Wallet, color: 'text-amber-600 dark:text-amber-500' },
    balance_updated: { Icon: Wallet, color: 'text-amber-600 dark:text-amber-500' },
    low_balance: { Icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-500' },
    credit_limit_reached: { Icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-500' },
    settlement_due: { Icon: AlertTriangle, color: 'text-rose-600 dark:text-rose-500' },

    complaint_received: { Icon: MessageSquare, color: 'text-purple-600 dark:text-purple-400' },
    complaint_resolved: { Icon: MessageSquare, color: 'text-purple-600 dark:text-purple-400' },
    complaint_rejected: { Icon: MessageSquare, color: 'text-rose-600 dark:text-rose-500' },

    account_suspended: { Icon: ShieldAlert, color: 'text-rose-600 dark:text-rose-500' },
    account_reactivated: { Icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-500' },
    role_upgraded: { Icon: UserCog, color: 'text-indigo-600 dark:text-indigo-400' },
    role_downgraded: { Icon: UserCog, color: 'text-amber-600 dark:text-amber-500' },
    security_new_login: { Icon: LogIn, color: 'text-amber-600 dark:text-amber-500' },
    security_password_changed: { Icon: Lock, color: 'text-amber-600 dark:text-amber-500' },
    api_key_created: { Icon: KeyRound, color: 'text-indigo-600 dark:text-indigo-400' },
    api_key_revoked: { Icon: KeyRound, color: 'text-rose-600 dark:text-rose-500' },

    announcement: { Icon: Megaphone, color: 'text-primary' },
    promo: { Icon: Tag, color: 'text-pink-600 dark:text-pink-400' },
    price_drop: { Icon: Tag, color: 'text-emerald-600 dark:text-emerald-500' },
    new_package: { Icon: Package, color: 'text-blue-600 dark:text-blue-500' },
    renewal_reminder: { Icon: Clock, color: 'text-amber-600 dark:text-amber-500' },

    system: { Icon: Bell, color: 'text-slate-500' },
}

export function getNotificationVisual(type: string): Visual {
    return TYPE_VISUAL[type] || TYPE_VISUAL.system
}

export function NotificationIcon({ type, className }: { type: string; className?: string }) {
    const { Icon, color } = getNotificationVisual(type)
    return <Icon className={className ?? `w-5 h-5 ${color}`} />
}

export { Loader2 }
