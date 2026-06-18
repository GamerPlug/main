import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/admin-auth'
import { sendAdminNewComplaintAlert } from '@/lib/email-service'
import { notifyAdmins, adminNewComplaintNotification } from '@/lib/notification-service'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function POST(request: Request) {
    try {
        const auth = await requireUser()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { order_id, title, description } = body

        if (!order_id || !title || !description) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        if (typeof order_id !== 'string' || !UUID_RE.test(order_id)) {
            return NextResponse.json({ error: 'Invalid order_id' }, { status: 400 })
        }

        const supabase = createServerClient()

        // Verify the order exists and belongs to the caller (prevents complaint IDOR
        // against arbitrary order IDs).
        const { data: order } = await supabase
            .from('orders')
            .select('id, user_id, reference_code')
            .eq('id', order_id)
            .single()

        if (!order || (order as any).user_id !== auth.userId) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 })
        }

        // 1. Insert complaint
        const { data: complaint, error: insertError } = await (supabase
            .from('complaints') as any)
            .insert({
                user_id: auth.userId,
                order_id,
                title,
                description,
                status: 'pending',
            })
            .select()
            .single()

        if (insertError) throw insertError

        // 2. Fetch user details for the admin alert
        const { data: userData } = await (supabase
            .from('users') as any)
            .select('email, first_name, last_name')
            .eq('id', auth.userId)
            .single()

        // 3. Send admin alerts (best-effort)
        if (userData) {
            try {
                await sendAdminNewComplaintAlert({
                    userEmail: userData.email,
                    userName: `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'User',
                    orderRef: (order as any).reference_code,
                    title,
                    description,
                })
            } catch (emailError) {
                console.error('Failed to send admin alert:', emailError)
            }

            const complainant = `${userData.first_name || ''} ${userData.last_name || ''}`.trim() || 'A user'
            notifyAdmins(
                adminNewComplaintNotification((order as any).reference_code, complainant),
            ).catch((err) => console.error('Failed to send admin in-app complaint alert:', err))
        }

        return NextResponse.json({ success: true, complaint })

    } catch (error: any) {
        console.error('Error submitting complaint:', error)
        return NextResponse.json(
            { error: error?.message || 'Failed to submit complaint' },
            { status: 500 }
        )
    }
}
