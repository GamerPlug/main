import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/admin-auth'
import { sendPushToUser } from '@/lib/web-push'

export const dynamic = 'force-dynamic'

export async function POST(_request: NextRequest) {
    const auth = await requireUser()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { sent } = await sendPushToUser(auth.userId, {
        title: 'Test Notification 🔔',
        body: 'Push notifications are working — you will now receive alerts here.',
        url: '/dashboard/notifications',
        type: 'system',
    })

    return NextResponse.json({ success: true, sent })
}
