// Shared iShare auto-fulfillment logic
// Called from: purchase route (on payment), webhook route (guest orders), admin API (manual trigger)
// Idempotency: checks ishare_fulfillment_logs before attempting — 'processing' and 'success'
// entries block re-attempts; 'failed' entries allow retries.

import { createServerClient } from '@/lib/supabase'
import { fulfillIShareOrder, parseBundleMB, normalizePhone } from '@/lib/spfastit-service'
import { createNotification, orderUpdateNotification } from '@/lib/notification-service'

export interface FulfillResult {
    success: boolean
    alreadyDone: boolean
    message: string
}

export async function fulfillIShareOrderWithTracking(
    orderId: string,
    phone: string,
    size: string,
    referenceCode: string,
    userId: string | null
): Promise<FulfillResult> {
    const supabase = createServerClient()

    // Idempotency guard — skip if already successfully completed
    // For 'processing' logs: allow retry if older than 5 minutes (stale/timed-out attempt)
    const STALE_PROCESSING_MS = 5 * 60 * 1000
    const staleThreshold = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()

    const { data: existingLog } = await (supabase
        .from('ishare_fulfillment_logs') as any)
        .select('id, status, created_at')
        .eq('order_id', orderId)
        .in('status', ['processing', 'success'])
        .maybeSingle()

    if (existingLog) {
        // Always block if already succeeded
        if (existingLog.status === 'success') {
            return { success: true, alreadyDone: true, message: 'Order already fulfilled successfully' }
        }

        // Block fresh processing attempts — but allow retry of stale ones
        if (existingLog.status === 'processing' && existingLog.created_at > staleThreshold) {
            return { success: false, alreadyDone: true, message: 'Fulfillment already in progress' }
        }

        // Stale processing log — mark it timed out so the retry can proceed
        await (supabase.from('ishare_fulfillment_logs') as any)
            .update({
                status: 'failed',
                error_reason: 'Timed out — no API response received within 5 minutes',
                updated_at: new Date().toISOString(),
            })
            .eq('id', existingLog.id)
    }

    const bundleMB = parseBundleMB(size)
    if (bundleMB === 0) {
        return {
            success: false,
            alreadyDone: false,
            message: `Cannot parse bundle size from "${size}"`,
        }
    }

    const normalizedPhone = normalizePhone(phone)

    // Insert processing log to act as an in-flight lock
    const { data: logRow, error: logInsertError } = await (supabase
        .from('ishare_fulfillment_logs') as any)
        .insert({
            order_id: orderId,
            status: 'processing',
            bundle_mb: bundleMB,
            phone_number: normalizedPhone,
        })
        .select('id')
        .single()

    if (logInsertError || !logRow) {
        console.error('[iShare] Failed to insert fulfillment log:', logInsertError)
        return {
            success: false,
            alreadyDone: false,
            message: 'Failed to create fulfillment log entry',
        }
    }

    const logId = logRow.id

    // Call the SPFastIT API
    const result = await fulfillIShareOrder(normalizedPhone, bundleMB)

    if (result.success) {
        // Update log to success
        await (supabase.from('ishare_fulfillment_logs') as any)
            .update({
                status: 'success',
                api_response: { message: result.message },
                updated_at: new Date().toISOString(),
            })
            .eq('id', logId)

        // Mark the order as completed
        await (supabase.from('orders') as any)
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', orderId)

        // Notify the user (skip for guest orders where userId is null)
        if (userId) {
            const notifData = orderUpdateNotification(referenceCode, 'completed')
            await createNotification({ userId, ...notifData }).catch(console.error)
        }
    } else {
        // Update log to failed with reason — order status stays 'pending'
        await (supabase.from('ishare_fulfillment_logs') as any)
            .update({
                status: 'failed',
                error_reason: result.message,
                api_response: { message: result.message },
                updated_at: new Date().toISOString(),
            })
            .eq('id', logId)
    }

    return { success: result.success, alreadyDone: false, message: result.message }
}
