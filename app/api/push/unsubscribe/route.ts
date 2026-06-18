import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    const auth = await requireUser()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const endpoint: string | undefined = body?.endpoint
    if (!endpoint) {
        return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
    }

    // Scoped to the owner so a user can only remove their own subscription.
    const supabase = createServerClient()
    const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_id', auth.userId)

    if (error) {
        console.error('[push/unsubscribe] delete error:', error.message)
        return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
