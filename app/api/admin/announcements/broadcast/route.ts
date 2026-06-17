import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { createBulkNotifications } from '@/lib/notification-service'

export const dynamic = 'force-dynamic'

const VALID_ROLES = ['all', 'admin', 'dealer', 'agent']

export async function POST(request: Request) {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const title: string = (body?.title || '').trim()
        const message: string = (body?.message || '').trim()
        const targetRole: string = body?.target_role || 'all'
        const sendPush: boolean = body?.send_push !== false

        if (!title || !message) {
            return NextResponse.json({ error: 'Title and message are required' }, { status: 400 })
        }
        if (!VALID_ROLES.includes(targetRole)) {
            return NextResponse.json({ error: 'Invalid target role' }, { status: 400 })
        }

        const supabase = createServerClient()

        // Resolve the audience.
        let usersQuery = supabase.from('users').select('id')
        if (targetRole !== 'all') {
            usersQuery = usersQuery.eq('role', targetRole)
        }
        const { data: users, error: usersError } = await usersQuery
        if (usersError) {
            console.error('[announcements/broadcast] users query error:', usersError.message)
            return NextResponse.json({ error: 'Failed to resolve audience' }, { status: 500 })
        }

        const userIds = (users || []).map((u: any) => u.id).filter(Boolean)
        if (userIds.length === 0) {
            return NextResponse.json({ success: true, created: 0 })
        }

        const result = await createBulkNotifications(userIds, {
            title,
            message,
            type: 'announcement',
            actionUrl: '/dashboard',
            push: sendPush,
        })

        if (!result.success) {
            return NextResponse.json({ error: 'Failed to broadcast' }, { status: 500 })
        }

        return NextResponse.json({ success: true, created: result.created })
    } catch (error: any) {
        console.error('[announcements/broadcast] error:', error)
        return NextResponse.json({ error: error?.message || 'Failed to broadcast' }, { status: 500 })
    }
}
