import type {
    NotificationCategory,
    NotificationPriority,
} from '@/types/supabase'

// ============================================================
// Client-safe notification taxonomy.
// IMPORTANT: this module must stay free of server-only imports
// (no createServerClient / service role) so it can be used in
// both client components and server code.
// ============================================================

export interface TypeMeta {
    category: NotificationCategory
    priority: NotificationPriority
    actionUrl?: string
}

export const TYPE_META: Record<string, TypeMeta> = {
    // Orders
    order_placed: { category: 'order', priority: 'normal', actionUrl: '/dashboard/my-orders' },
    order_processing: { category: 'order', priority: 'low', actionUrl: '/dashboard/my-orders' },
    order_completed: { category: 'order', priority: 'normal', actionUrl: '/dashboard/my-orders' },
    order_failed: { category: 'order', priority: 'high', actionUrl: '/dashboard/my-orders' },
    order_update: { category: 'order', priority: 'normal', actionUrl: '/dashboard/my-orders' },
    // Money
    payment_success: { category: 'payment', priority: 'normal', actionUrl: '/dashboard/wallet' },
    refund_issued: { category: 'payment', priority: 'high', actionUrl: '/dashboard/wallet' },
    balance_credited: { category: 'payment', priority: 'normal', actionUrl: '/dashboard/wallet' },
    balance_debited: { category: 'payment', priority: 'normal', actionUrl: '/dashboard/wallet' },
    balance_updated: { category: 'payment', priority: 'normal', actionUrl: '/dashboard/wallet' },
    low_balance: { category: 'payment', priority: 'high', actionUrl: '/dashboard/wallet' },
    credit_limit_reached: { category: 'payment', priority: 'high', actionUrl: '/dashboard/wallet' },
    settlement_due: { category: 'payment', priority: 'high', actionUrl: '/dashboard/wallet' },
    // Complaints (account/security bucket)
    complaint_received: { category: 'security', priority: 'normal', actionUrl: '/admin/complaints' },
    complaint_resolved: { category: 'security', priority: 'normal', actionUrl: '/dashboard/complaints' },
    complaint_rejected: { category: 'security', priority: 'normal', actionUrl: '/dashboard/complaints' },
    // Account & security
    account_suspended: { category: 'security', priority: 'high', actionUrl: '/dashboard/profile' },
    account_reactivated: { category: 'security', priority: 'high', actionUrl: '/dashboard/profile' },
    role_upgraded: { category: 'security', priority: 'normal', actionUrl: '/dashboard/profile' },
    role_downgraded: { category: 'security', priority: 'normal', actionUrl: '/dashboard/profile' },
    security_new_login: { category: 'security', priority: 'high', actionUrl: '/dashboard/profile' },
    security_password_changed: { category: 'security', priority: 'high', actionUrl: '/dashboard/profile' },
    api_key_created: { category: 'security', priority: 'normal', actionUrl: '/dashboard/developer' },
    api_key_revoked: { category: 'security', priority: 'high', actionUrl: '/dashboard/developer' },
    // Broadcast & marketing
    announcement: { category: 'announcement', priority: 'normal', actionUrl: '/dashboard' },
    promo: { category: 'marketing', priority: 'low', actionUrl: '/dashboard/data-packages' },
    new_package: { category: 'marketing', priority: 'low', actionUrl: '/dashboard/data-packages' },
    price_drop: { category: 'marketing', priority: 'low', actionUrl: '/dashboard/data-packages' },
    renewal_reminder: { category: 'security', priority: 'normal', actionUrl: '/dashboard/profile' },
    // Admin-facing
    admin_new_order: { category: 'order', priority: 'normal', actionUrl: '/admin/orders' },
    admin_new_registration: { category: 'security', priority: 'normal', actionUrl: '/admin/users' },
    // Fallback
    system: { category: 'system', priority: 'normal', actionUrl: '/dashboard/notifications' },
}

export function getNotificationMeta(type: string): TypeMeta {
    return TYPE_META[type] || { category: 'system', priority: 'normal', actionUrl: '/dashboard/notifications' }
}

export function getNotificationCategory(type: string): NotificationCategory {
    return getNotificationMeta(type).category
}

// --- Preference defaults + gating -----------------------------------------
export const DEFAULT_PREFS = {
    order_updates: true,
    payments: true,
    security: true,
    announcements: true,
    marketing: false,
    push_enabled: true,
}

export type PrefKey = keyof typeof DEFAULT_PREFS

export function prefKeyForCategory(category: NotificationCategory): PrefKey | null {
    switch (category) {
        case 'order': return 'order_updates'
        case 'payment': return 'payments'
        case 'security': return 'security'
        case 'announcement': return 'announcements'
        case 'marketing': return 'marketing'
        default: return null // 'system' is always delivered
    }
}

export function categoryEnabled(prefs: typeof DEFAULT_PREFS, category: NotificationCategory): boolean {
    const key = prefKeyForCategory(category)
    if (!key) return true
    return prefs[key] !== false
}

// --- UI metadata (labels for filter chips / preference toggles) -----------
export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
    order: 'Orders',
    payment: 'Payments',
    security: 'Account & Security',
    announcement: 'Announcements',
    marketing: 'Promotions',
    system: 'System',
}

/** All known notification types belonging to a category (for DB `.in('type', ...)` filters). */
export function typesForCategory(category: NotificationCategory): string[] {
    return Object.entries(TYPE_META)
        .filter(([, meta]) => meta.category === category)
        .map(([type]) => type)
}
