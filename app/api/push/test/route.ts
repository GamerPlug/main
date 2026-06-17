import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendPushToUser } from '@/lib/web-push'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore,
    })
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sent } = await sendPushToUser(session.user.id, {
        title: 'Test Notification 🔔',
        body: 'Push notifications are working — you will now receive alerts here.',
        url: '/dashboard/notifications',
        type: 'system',
    })

    return NextResponse.json({ success: true, sent })
}
