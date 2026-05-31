import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    // 1. Authenticate API Key
    const { context, error } = await validateApiKey(request)
    if (error || !context) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })
    }

    if (context.requiresSettlement) {
        return NextResponse.json({ 
            error: 'Account settlement required. Please contact admin to activate your API access.' 
        }, { status: 403 })
    }

    const { userId } = context

    // 2. Identify order (via orderId or referenceCode from search params)
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    const referenceCode = searchParams.get('reference') || searchParams.get('referenceCode')

    if (!orderId && !referenceCode) {
        return NextResponse.json({ error: 'Missing orderId or reference query parameter' }, { status: 400 })
    }

    // 3. Fetch Order
    const supabase = createServerClient()
    let query = supabase.from('orders').select(`
        id,
        reference_code,
        status,
        payment_status,
        network,
        size,
        amount,
        phone_number,
        created_at,
        updated_at
    `).eq('user_id', userId)

    if (orderId) {
        query = query.eq('id', orderId)
    } else if (referenceCode) {
        query = query.eq('reference_code', referenceCode)
    }

    const { data: order, error: orderError } = await query.single()

    if (orderError || !order) {
        return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 })
    }

    // 4. Return Order Status
    return NextResponse.json({
        order_id: order.id,
        reference_code: order.reference_code,
        status: order.status,
        payment_status: order.payment_status,
        network: order.network,
        size: order.size,
        amount: parseFloat(order.amount.toString()),
        phone_number: order.phone_number,
        created_at: order.created_at,
        updated_at: order.updated_at
    })
}
