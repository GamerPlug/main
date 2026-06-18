import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createNotification, accountStatusNotification } from '@/lib/notification-service'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(request: Request) {
    try {
        const { userId, status } = await request.json()

        if (!userId || !status) {
            return NextResponse.json(
                { error: 'User ID and status are required' },
                { status: 400 }
            )
        }

        if (!['active', 'suspended', 'inactive'].includes(status)) {
            return NextResponse.json(
                { error: 'Invalid status. Must be active, suspended, or inactive' },
                { status: 400 }
            )
        }

        // Verify requester is admin (server-verified getUser())
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // Prevent changing own status
        if (userId === auth.userId) {
            return NextResponse.json(
                { error: 'Cannot change your own account status' },
                { status: 400 }
            )
        }

        // Use service role client for the update (bypasses RLS)
        const supabaseAdmin = createServerClient()

        // Update user status
        const { error: updateError } = await (supabaseAdmin
            .from('users') as any)
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', userId)

        if (updateError) {
            console.error('Error updating user status:', updateError)
            return NextResponse.json(
                { error: `Failed to update user status: ${updateError.message}` },
                { status: 500 }
            )
        }

        console.log(`[Admin] User ${userId} status updated to ${status} by ${auth.userId}`)

        // Notify the affected user (in-app + best-effort push) for suspend/reactivate.
        if (status === 'suspended' || status === 'active') {
            await createNotification({
                userId,
                ...accountStatusNotification(status === 'suspended' ? 'suspended' : 'reactivated'),
            }).catch((e) => console.error('[Admin] Status notification error:', e))
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Update status error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
