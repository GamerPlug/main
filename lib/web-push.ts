import webpush from 'web-push'
import { createServerClient } from '@/lib/supabase'

// ============================================================
// Web Push (VAPID) sender.
// Server-only. Lazily configured so a missing VAPID key never
// crashes the app at import time — push simply becomes a no-op.
// ============================================================

let configured: boolean | null = null

function ensureConfigured(): boolean {
    if (configured !== null) return configured

    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    const subject = process.env.VAPID_SUBJECT || 'mailto:support@gamerplug.com'

    if (!publicKey || !privateKey) {
        console.warn('[web-push] VAPID keys not set — web push is disabled.')
        configured = false
        return false
    }

    try {
        webpush.setVapidDetails(subject, publicKey, privateKey)
        configured = true
    } catch (err) {
        console.error('[web-push] Failed to configure VAPID:', err)
        configured = false
    }
    return configured
}

export interface PushPayload {
    title: string
    body: string
    url?: string
    type?: string
    priority?: string
}

interface SubRow {
    id: string
    endpoint: string
    p256dh: string
    auth: string
}

async function deliver(supabase: any, sub: SubRow, payloadStr: string): Promise<boolean> {
    try {
        await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr,
        )
        return true
    } catch (err: any) {
        const status = err?.statusCode
        // 404/410 => subscription gone. Prune it so we stop trying.
        if (status === 404 || status === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
            console.error('[web-push] send error', status, err?.body || err?.message)
        }
        return false
    }
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<{ sent: number }> {
    if (!ensureConfigured()) return { sent: 0 }

    const supabase = createServerClient()
    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint, p256dh, auth')
        .eq('user_id', userId)

    if (!subs || subs.length === 0) return { sent: 0 }

    const payloadStr = JSON.stringify(payload)
    const results = await Promise.all(
        (subs as SubRow[]).map((s) => deliver(supabase, s, payloadStr)),
    )
    return { sent: results.filter(Boolean).length }
}

export async function sendPushToMany(userIds: string[], payload: PushPayload): Promise<{ sent: number }> {
    if (!ensureConfigured()) return { sent: 0 }
    const ids = Array.from(new Set(userIds)).filter(Boolean)
    if (ids.length === 0) return { sent: 0 }

    const supabase = createServerClient()
    const payloadStr = JSON.stringify(payload)
    let sent = 0

    const IN_CHUNK = 200
    for (let i = 0; i < ids.length; i += IN_CHUNK) {
        const slice = ids.slice(i, i + IN_CHUNK)
        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('id, endpoint, p256dh, auth')
            .in('user_id', slice)

        if (!subs || subs.length === 0) continue

        const results = await Promise.all(
            (subs as SubRow[]).map((s) => deliver(supabase, s, payloadStr)),
        )
        sent += results.filter(Boolean).length
    }
    return { sent }
}
