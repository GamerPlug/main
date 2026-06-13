import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { fulfillMTNOrder } from '@/lib/mtn-fulfillment'
import { fulfillOrder as fulfillOtherOrder } from '@/lib/at-ishare-service'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const reference = searchParams.get('reference')

        if (!reference) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=no_reference`)
        }

        const supabase = createServerClient()

        // 1. Verify with Paystack
        const paystackResponse = await fetch(
            `https://api.paystack.co/transaction/verify/${reference}`,
            {
                headers: {
                    'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                },
            }
        )

        const paystackData = await paystackResponse.json()

        if (!paystackData.status || paystackData.data.status !== 'success') {
            console.error('[GuestVerify] Paystack verification failed:', paystackData)
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=payment_failed`)
        }

        // 2. Get the guest order
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('reference_code', reference)
            .single()

        if (orderError || !order) {
            console.error('[GuestVerify] Order not found:', reference)
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=order_not_found`)
        }

        // If already paid, just redirect to status tab
        if (order.payment_status === 'paid') {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/guest/purchase?ref=${reference}`)
        }

        // 3. Atomically flip unpaid -> paid. The conditional guard ensures only
        // ONE process (this callback OR the Paystack webhook) wins the race and
        // proceeds to fulfillment, preventing duplicate data delivery.
        const { data: claimedRows, error: claimError } = await (supabase.from('orders') as any)
            .update({
                payment_status: 'paid',
                updated_at: new Date().toISOString()
            })
            .eq('id', order.id)
            .eq('payment_status', 'unpaid')
            .select('id')

        if (claimError) {
            console.error('[GuestVerify] Failed to mark order paid:', claimError)
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/guest/purchase?ref=${reference}`)
        }

        // No row claimed => another process already paid+fulfilled this order.
        if (!claimedRows || claimedRows.length === 0) {
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/guest/purchase?ref=${reference}`)
        }

        // 4. Trigger Fulfillment (Async) — only the winner of the claim reaches here
        triggerGuestFulfillment(order.id, order.network, order.phone_number, order.size)

        // 5. Redirect to status tab
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/guest/purchase?ref=${reference}&success=true`)

    } catch (error) {
        console.error('[GuestVerify] Exception:', error)
        return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/?error=verification_failed`)
    }
}

async function triggerGuestFulfillment(orderId: string, network: string, phoneNumber: string, size: string) {
    const supabase = createServerClient() // Uses service role by default in my lib/supabase if configured

    try {
        let result;
        if (network === 'MTN') {
            result = await fulfillMTNOrder(phoneNumber, size, orderId)
        } else {
            result = await fulfillOtherOrder(phoneNumber, size, network)
        }

        if (result.success) {
            await supabase
                .from('orders')
                .update({
                    status: 'processing',
                    provider_ref: (result as any).reference || (result as any).reference_id
                })
                .eq('id', orderId)
        }
    } catch (err) {
        console.error('[GuestFulfillment] Error:', err)
    }
}
