import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/admin-auth'
import { getPushSubscribeRatelimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const auth = await requireUser()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }
    const userId = auth.userId

    // Best-effort rate limit (skips silently if Upstash is not configured).
    try {
        const { success } = await getPushSubscribeRatelimit().limit(`sub:${userId}`)
        if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    } catch {
        /* rate limiter unavailable — continue */
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const sub = body?.subscription
    const endpoint: string | undefined = sub?.endpoint
    const p256dh: string | undefined = sub?.keys?.p256dh
    const authKey: string | undefined = sub?.keys?.auth

    if (!endpoint || !p256dh || !authKey) {
        return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
    }

    // Use the service role so an endpoint that previously belonged to another
    // account (shared device) can be reassigned to the current user. user_id is
    // ALWAYS taken from the authenticated session, never from the request body.
    const supabase = createServerClient()
    const { error } = await (supabase.from('push_subscriptions') as any).upsert(
        {
            user_id: userId,
            endpoint,
            p256dh,
            auth: authKey,
            user_agent: request.headers.get('user-agent') || null,
            last_used_at: new Date().toISOString(),
        },
        { onConflict: 'endpoint' },
    )

    if (error) {
        console.error('[push/subscribe] upsert error:', error.message)
        return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
