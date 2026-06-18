import { NextRequest, NextResponse } from 'next/server'
import { cleanupOldNotifications } from '@/lib/notification-service'
import { verifyCronSecret } from '@/lib/cron-auth'

export async function GET(request: NextRequest) {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        // Policy (B2 fix): keep unseen alerts alive.
        //   - read notifications older than 7 days   -> deleted
        //   - any notification older than 30 days     -> deleted (incl. unread)
        const result = await cleanupOldNotifications()

        if (!result.success) {
            throw result.error
        }

        console.log(
            `Notification cleanup: removed ${result.deletedRead} read (>7d) and ${result.deletedOld} stale (>30d)`,
        )

        return NextResponse.json({
            success: true,
            deletedRead: result.deletedRead,
            deletedOld: result.deletedOld,
        })
    } catch (error) {
        console.error('Cron delete-old-notifications error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
