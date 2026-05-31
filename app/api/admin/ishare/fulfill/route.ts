import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { fulfillIShareOrderWithTracking } from '@/lib/ishare-fulfillment'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore,
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { orderId } = body

        const supabase = createServerClient()

        let orders: any[] = []

        if (orderId) {
            // Single order fulfillment
            const { data: order, error } = await supabase
                .from('orders')
                .select('id, phone_number, size, reference_code, user_id, status, payment_status, network')
                .eq('id', orderId)
                .eq('network', 'AT-iShare')
                .single()

            if (error || !order) {
                return NextResponse.json({ error: 'Order not found or not an AT-iShare order' }, { status: 404 })
            }
            orders = [order]
        } else {
            // Bulk: all pending paid AT-iShare orders
            const { data, error } = await supabase
                .from('orders')
                .select('id, phone_number, size, reference_code, user_id, status, payment_status, network')
                .eq('network', 'AT-iShare')
                .eq('status', 'pending')
                .eq('payment_status', 'paid')
                .order('created_at', { ascending: true })
                .limit(100)

            if (error) {
                throw error
            }
            orders = data || []
        }

        const results: Array<{ orderId: string; ref: string; success: boolean; skipped: boolean; message: string }> = []
        let fulfilled = 0
        let skipped = 0
        let failed = 0

        for (const order of orders) {
            // Skip if already completed
            if (order.status === 'completed') {
                results.push({ orderId: order.id, ref: order.reference_code, success: true, skipped: true, message: 'Already completed' })
                skipped++
                continue
            }

            const result = await fulfillIShareOrderWithTracking(
                order.id,
                order.phone_number,
                order.size,
                order.reference_code,
                order.user_id
            )

            results.push({
                orderId: order.id,
                ref: order.reference_code,
                success: result.success,
                skipped: result.alreadyDone,
                message: result.message,
            })

            if (result.alreadyDone) skipped++
            else if (result.success) fulfilled++
            else failed++
        }

        return NextResponse.json({
            success: true,
            total: orders.length,
            fulfilled,
            skipped,
            failed,
            results,
        })
    } catch (error: any) {
        console.error('[Admin iShare Fulfill] Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
