import { createServerClient } from '@/lib/supabase'
import type {
    NotificationType,
    NotificationPriority,
} from '@/types/supabase'
import {
    getNotificationMeta,
    DEFAULT_PREFS,
    prefKeyForCategory,
    categoryEnabled,
} from '@/lib/notification-meta'

// Re-export client-safe helpers for existing server-side importers.
export { getNotificationMeta, getNotificationCategory } from '@/lib/notification-meta'

async function getPreferences(supabase: any, userId: string): Promise<typeof DEFAULT_PREFS> {
    const { data } = await supabase
        .from('notification_preferences')
        .select('order_updates, payments, security, announcements, marketing, push_enabled')
        .eq('user_id', userId)
        .maybeSingle()
    return data ? { ...DEFAULT_PREFS, ...data } : { ...DEFAULT_PREFS }
}

// ============================================================
// Core API
// ============================================================
export interface CreateNotificationInput {
    userId: string
    title: string
    message: string
    type: NotificationType
    actionUrl?: string
    priority?: NotificationPriority
    metadata?: Record<string, unknown>
    /** When set, a duplicate notification with the same key for this user is skipped. */
    dedupeKey?: string
    /** Set false to store the in-app notification without attempting a web push. */
    push?: boolean
}

type CreateResult =
    | { success: true; skipped?: 'duplicate' | 'opted_out' }
    | { success: false; error: unknown }

export async function createNotification(input: CreateNotificationInput): Promise<CreateResult> {
    const supabase = createServerClient()

    try {
        const meta = getNotificationMeta(input.type)
        const category = meta.category
        const priority = input.priority ?? meta.priority
        const actionUrl = input.actionUrl ?? meta.actionUrl

        const prefs = await getPreferences(supabase, input.userId)

        // Marketing is opt-in: if the user opted out, do not even store it.
        if (category === 'marketing' && prefs.marketing === false) {
            return { success: true, skipped: 'opted_out' }
        }

        const metadata = {
            ...(input.metadata || {}),
            ...(input.dedupeKey ? { dedupe_key: input.dedupeKey } : {}),
        }

        // Idempotency: skip if a notification with this dedupe key already exists.
        if (input.dedupeKey) {
            const { data: existing } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', input.userId)
                .eq('metadata->>dedupe_key', input.dedupeKey)
                .limit(1)
                .maybeSingle()
            if (existing) return { success: true, skipped: 'duplicate' }
        }

        const { error } = await (supabase.from('notifications') as any).insert({
            user_id: input.userId,
            title: input.title,
            message: input.message,
            type: input.type,
            action_url: actionUrl,
            priority,
            metadata,
            is_read: false,
        })

        if (error) {
            console.error('Failed to create notification:', error)
            return { success: false, error }
        }

        // Best-effort web push — never let push failures break the caller.
        const wantPush = input.push !== false
        if (wantPush && prefs.push_enabled !== false && categoryEnabled(prefs, category)) {
            try {
                const { sendPushToUser } = await import('@/lib/web-push')
                await sendPushToUser(input.userId, {
                    title: input.title,
                    body: input.message,
                    url: actionUrl,
                    type: input.type,
                    priority,
                })
            } catch (pushError) {
                console.error('Push send error:', pushError)
            }
        }

        return { success: true }
    } catch (error) {
        console.error('Notification error:', error)
        return { success: false, error }
    }
}

/**
 * Fan-out used by admin broadcasts. Callers are expected to have already
 * resolved the target audience (e.g. by role). Per-user marketing/announcement
 * opt-outs are honoured here. Inserts and pushes are chunked.
 */
export async function createBulkNotifications(
    userIds: string[],
    data: Omit<CreateNotificationInput, 'userId'>,
): Promise<{ success: boolean; created: number; error?: unknown }> {
    const supabase = createServerClient()

    try {
        const meta = getNotificationMeta(data.type)
        const category = meta.category
        const priority = data.priority ?? meta.priority
        const actionUrl = data.actionUrl ?? meta.actionUrl
        const baseMetadata = {
            ...(data.metadata || {}),
            ...(data.dedupeKey ? { dedupe_key: data.dedupeKey } : {}),
        }

        let recipients = Array.from(new Set(userIds)).filter(Boolean)
        if (recipients.length === 0) return { success: true, created: 0 }

        // Honour opt-outs for opt-out-able categories (announcement / marketing).
        const prefKey = prefKeyForCategory(category)
        if (prefKey === 'announcements' || prefKey === 'marketing') {
            const { data: optedOut } = await supabase
                .from('notification_preferences')
                .select('user_id')
                .eq(prefKey, false)
                .in('user_id', recipients)
            const optedOutSet = new Set((optedOut || []).map((r: any) => r.user_id))
            recipients = recipients.filter((id) => !optedOutSet.has(id))
        }
        if (recipients.length === 0) return { success: true, created: 0 }

        // Chunked insert.
        const INSERT_CHUNK = 500
        let created = 0
        for (let i = 0; i < recipients.length; i += INSERT_CHUNK) {
            const slice = recipients.slice(i, i + INSERT_CHUNK)
            const rows = slice.map((userId) => ({
                user_id: userId,
                title: data.title,
                message: data.message,
                type: data.type,
                action_url: actionUrl,
                priority,
                metadata: baseMetadata,
                is_read: false,
            }))
            const { error } = await (supabase.from('notifications') as any).insert(rows)
            if (error) {
                console.error('Bulk notification insert error:', error)
                return { success: false, created, error }
            }
            created += slice.length
        }

        // Best-effort push fan-out (respects push_enabled per-subscription owner).
        if (data.push !== false) {
            try {
                const { sendPushToMany } = await import('@/lib/web-push')
                await sendPushToMany(recipients, {
                    title: data.title,
                    body: data.message,
                    url: actionUrl,
                    type: data.type,
                    priority,
                })
            } catch (pushError) {
                console.error('Bulk push error:', pushError)
            }
        }

        return { success: true, created }
    } catch (error) {
        console.error('Bulk notification error:', error)
        return { success: false, created: 0, error }
    }
}

/**
 * Fan-out to all admins / sub-admins. Used for operational alerts
 * (new orders, registrations, complaints). Best-effort; never throws.
 */
export async function notifyAdmins(
    data: Omit<CreateNotificationInput, 'userId'>,
    opts?: { excludeUserId?: string },
): Promise<{ success: boolean; created: number }> {
    try {
        const supabase = createServerClient()
        const { data: admins, error } = await supabase
            .from('users')
            .select('id')
            .in('role', ['admin', 'sub-admin'])
        if (error) {
            console.error('[notifyAdmins] admin lookup error:', error)
            return { success: false, created: 0 }
        }
        let ids = (admins || []).map((a: any) => a.id).filter(Boolean)
        if (opts?.excludeUserId) ids = ids.filter((id) => id !== opts.excludeUserId)
        if (ids.length === 0) return { success: true, created: 0 }
        const res = await createBulkNotifications(ids, data)
        return { success: res.success, created: res.created }
    } catch (e) {
        console.error('[notifyAdmins] error:', e)
        return { success: false, created: 0 }
    }
}

// ============================================================
// Read / delete helpers (also used server-side)
// ============================================================
export async function markAsRead(notificationId: string, userId: string) {
    const supabase = createServerClient()
    const { error } = await (supabase.from('notifications') as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('user_id', userId)
    return { success: !error, error }
}

export async function markAllAsRead(userId: string) {
    const supabase = createServerClient()
    const { error } = await (supabase.from('notifications') as any)
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('is_read', false)
    return { success: !error, error }
}

export async function deleteNotification(notificationId: string, userId: string) {
    const supabase = createServerClient()
    const { error } = await (supabase.from('notifications') as any)
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId)
    return { success: !error, error }
}

/**
 * Cleanup policy (B2 fix): keep unseen alerts alive.
 *   - read notifications older than 7 days  -> deleted
 *   - any notification older than 30 days   -> deleted (incl. unread)
 */
export async function cleanupOldNotifications() {
    const supabase = createServerClient()

    const readCutoff = new Date()
    readCutoff.setDate(readCutoff.getDate() - 7)

    const hardCutoff = new Date()
    hardCutoff.setDate(hardCutoff.getDate() - 30)

    const { error: readErr, count: readCount } = await (supabase.from('notifications') as any)
        .delete({ count: 'exact' })
        .eq('is_read', true)
        .lt('created_at', readCutoff.toISOString())

    const { error: hardErr, count: hardCount } = await (supabase.from('notifications') as any)
        .delete({ count: 'exact' })
        .lt('created_at', hardCutoff.toISOString())

    return {
        success: !readErr && !hardErr,
        deletedRead: readCount || 0,
        deletedOld: hardCount || 0,
        error: readErr || hardErr,
    }
}

// ============================================================
// Templates — return the shape consumed by createNotification.
// Existing callers spread these with a userId.
// ============================================================
type Template = Omit<CreateNotificationInput, 'userId'>

export function orderPlacedNotification(orderRef: string, summary?: string): Template {
    return {
        title: 'Order Received',
        message: summary
            ? `Your order ${orderRef} (${summary}) has been received and is being processed.`
            : `Your order ${orderRef} has been received and is being processed.`,
        type: 'order_placed',
        metadata: { order_ref: orderRef },
        dedupeKey: `order_placed:${orderRef}`,
    }
}

export function orderUpdateNotification(orderRef: string, status: string): Template {
    const statusMessages: Record<string, string> = {
        processing: `Your order ${orderRef} is being processed.`,
        completed: `Your order ${orderRef} has been completed successfully!`,
        failed: `Your order ${orderRef} has failed. Please file a complaint for a refund.`,
    }
    const typeMap: Record<string, NotificationType> = {
        processing: 'order_processing',
        completed: 'order_completed',
        failed: 'order_failed',
    }
    const type = typeMap[status] || 'order_update'
    return {
        title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: statusMessages[status] || `Order ${orderRef} status updated to ${status}`,
        type,
        metadata: { order_ref: orderRef, status },
        dedupeKey: `${type}:${orderRef}`,
    }
}

export function paymentSuccessNotification(amount: number, reference?: string): Template {
    return {
        title: 'Payment Successful',
        message: `Your wallet has been credited with GHS ${amount.toFixed(2)}`,
        type: 'payment_success',
        metadata: { amount, reference },
        ...(reference ? { dedupeKey: `payment_success:${reference}` } : {}),
    }
}

export function refundIssuedNotification(amount: number, orderRef?: string): Template {
    return {
        title: 'Refund Issued',
        message: `A refund of GHS ${amount.toFixed(2)}${orderRef ? ` for order ${orderRef}` : ''} has been credited to your wallet.`,
        type: 'refund_issued',
        metadata: { amount, order_ref: orderRef },
        ...(orderRef ? { dedupeKey: `refund_issued:${orderRef}` } : {}),
    }
}

export function complaintResolvedNotification(orderRef: string, status: 'resolved' | 'rejected', notes?: string): Template {
    return {
        title: `Complaint ${status === 'resolved' ? 'Resolved' : 'Rejected'}`,
        message: `Your complaint regarding order ${orderRef} has been ${status}.${notes ? ` ${notes}` : ''}`,
        type: status === 'resolved' ? 'complaint_resolved' : 'complaint_rejected',
        metadata: { order_ref: orderRef, status },
    }
}

export function balanceUpdatedNotification(amount: number, type: 'credit' | 'debit', note?: string): Template {
    const action = type === 'credit' ? 'credited' : 'debited'
    return {
        title: `Wallet ${action.charAt(0).toUpperCase() + action.slice(1)}`,
        message: `Your wallet has been ${action} with GHS ${amount.toFixed(2)}.${note ? ` ${note}` : ''}`,
        type: type === 'credit' ? 'balance_credited' : 'balance_debited',
        metadata: { amount, direction: type },
    }
}

export function lowBalanceNotification(balance: number): Template {
    return {
        title: 'Low Wallet Balance',
        message: `Your wallet balance is low (GHS ${balance.toFixed(2)}). Top up to avoid interrupted orders.`,
        type: 'low_balance',
        metadata: { balance },
    }
}

export function accountStatusNotification(status: 'suspended' | 'reactivated', reason?: string): Template {
    return status === 'suspended'
        ? {
            title: 'Account Suspended',
            message: `Your account has been suspended.${reason ? ` Reason: ${reason}` : ' Please contact support.'}`,
            type: 'account_suspended',
        }
        : {
            title: 'Account Reactivated',
            message: 'Your account has been reactivated. Welcome back!',
            type: 'account_reactivated',
        }
}

export function roleChangeNotification(newRole: string, direction: 'upgraded' | 'downgraded'): Template {
    return {
        title: `Account ${direction === 'upgraded' ? 'Upgraded' : 'Updated'}`,
        message: `Your account role is now "${newRole}".`,
        type: direction === 'upgraded' ? 'role_upgraded' : 'role_downgraded',
        metadata: { role: newRole },
    }
}

export function apiKeyNotification(action: 'created' | 'revoked', keyName: string): Template {
    return {
        title: action === 'created' ? 'API Key Created' : 'API Key Revoked',
        message: `Your API key "${keyName}" was ${action}.${action === 'created' ? ' Keep it secret.' : ''}`,
        type: action === 'created' ? 'api_key_created' : 'api_key_revoked',
        metadata: { key_name: keyName },
    }
}

export function announcementNotification(title: string, message: string): Template {
    return { title, message, type: 'announcement' }
}

// --- Admin-facing templates ---------------------------------------------
export function adminNewOrderNotification(args: {
    orderRef: string
    network: string
    size: string
    amount: number
    phone: string
}): Template {
    return {
        title: 'New Order',
        message: `${args.network} ${args.size} → ${args.phone} (GHS ${args.amount.toFixed(2)}) · ${args.orderRef}`,
        type: 'admin_new_order',
        metadata: { order_ref: args.orderRef },
        dedupeKey: `admin_new_order:${args.orderRef}`,
    }
}

export function adminNewRegistrationNotification(name: string, email: string): Template {
    return {
        title: 'New Registration',
        message: `${name} (${email}) just created an account.`,
        type: 'admin_new_registration',
        metadata: { email },
        dedupeKey: `admin_new_registration:${email}`,
    }
}

export function adminNewComplaintNotification(orderRef: string, complainant: string): Template {
    return {
        title: 'New Complaint',
        message: `${complainant} filed a complaint on order ${orderRef}.`,
        type: 'complaint_received',
        metadata: { order_ref: orderRef },
    }
}
