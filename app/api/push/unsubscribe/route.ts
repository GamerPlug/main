import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getSession() {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore,
    })
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
}

export async function POST(request: NextRequest) {
    const { session, error: sessionError } = await getSession()
    if (sessionError || !session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        .eq('user_id', session.user.id)

    if (error) {
        console.error('[push/unsubscribe] delete error:', error.message)
        return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
