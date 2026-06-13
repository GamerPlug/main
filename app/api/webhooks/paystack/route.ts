import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createServerClient } from '@/lib/supabase'
import { fulfillMTNOrder } from '@/lib/mtn-fulfillment'
import { fulfillOrder as fulfillOtherOrder } from '@/lib/at-ishare-service'
import { fulfillIShareOrderWithTracking } from '@/lib/ishare-fulfillment'

export async function POST(request: NextRequest) {
    try {
        const secret = process.env.PAYSTACK_SECRET_KEY
        if (!secret) {
            console.error('[PaystackWebhook] PAYSTACK_SECRET_KEY is not defined')
            return NextResponse.json({ message: 'Server configuration error' }, { status: 500 })
        }

        // 1. Verify webhook signature
        const body = await request.text()
        const hash = crypto
            .createHmac('sha512', secret)
            .update(body)
            .digest('hex')

        const signature = request.headers.get('x-paystack-signature') || ''

        // Constant-time comparison to avoid leaking the expected signature via timing
        const hashBuf = Buffer.from(hash)
        const sigBuf = Buffer.from(signature)
        if (hashBuf.length !== sigBuf.length || !crypto.timingSafeEqual(hashBuf, sigBuf)) {
            console.error('[PaystackWebhook] Invalid webhook signature')
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
        }

        // 2. Parse event
        const event = JSON.parse(body)

        // 3. Only handle charge.success
        if (event.event === 'charge.success') {
            const { reference, amount: paidAmountKobo, metadata } = event.data

            const supabase = createServerClient()

            // 4. Route directly by payment type
            const isGuestOrder = reference.startsWith('GST-')

            // --- GUEST ORDER (direct Paystack payment for data purchase) ---
            if (isGuestOrder) {
                console.log('[PaystackWebhook] Identified as GUEST ORDER:', reference)
                await processGuestOrderPayment(supabase, reference)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // --- WALLET PAYMENTS (top-ups & upgrades) ---
            const { data: payment } = await supabase
                .from('wallet_payments')
                .select('total_amount, status')
                .eq('reference', reference)
                .single()

            if (!payment) {
                console.error('[PaystackWebhook] Payment not found in wallet_payments:', reference)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // Verify amount
            const expectedAmountKobo = Math.round((payment as any).total_amount * 100)
            console.log(`[PaystackWebhook] Verifying amount for ${reference}: Expected ${expectedAmountKobo}, Received ${paidAmountKobo}`)

            if (paidAmountKobo !== expectedAmountKobo) {
                console.error(`[PaystackWebhook] AMOUNT MISMATCH for ${reference}: Expected ${expectedAmountKobo}, got ${paidAmountKobo}`)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // --- WALLET PAYMENTS (top-ups) ---
            console.log('[PaystackWebhook] Identified as WALLET TOPUP')
            const result = await processCompletedWalletPayment(reference, event.data)

            if (!result.success && !result.alreadyProcessed) {
                console.error('[PaystackWebhook] processCompletedWalletPayment FAILED:', reference, result.error)
            } else {
                console.log('[PaystackWebhook] processCompletedWalletPayment SUCCESS/ALREADY_DONE:', reference)
            }
        }

        return NextResponse.json({ received: true }, { status: 200 })

    } catch (error) {
        console.error('[PaystackWebhook] Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}

/**
 * Handles guest order payments that go directly through Paystack
 * (not through the wallet system). Updates payment_status on the
 * orders table and triggers fulfillment.
 */
async function processGuestOrderPayment(supabase: any, reference: string) {
    try {
        // Look up order by reference_code
        const { data: order, error: orderError } = await supabase
            .from('orders')
            .select('*')
            .eq('reference_code', reference)
            .single()

        if (orderError || !order) {
            console.log('[PaystackWebhook] No matching order found either, skipping:', reference)
            return
        }

        // Idempotency: skip if already paid
        if (order.payment_status === 'paid') {
            console.log('[PaystackWebhook] Guest order already paid, skipping:', reference)
            return
        }

        // Mark order as paid
        const { error: updateError } = await supabase
            .from('orders')
            .update({
                payment_status: 'paid',
                updated_at: new Date().toISOString()
            })
            .eq('id', order.id)
            .eq('payment_status', 'unpaid') // Atomic check to prevent double processing

        if (updateError) {
            console.error('[PaystackWebhook] Failed to update guest order payment_status:', updateError)
            return
        }

        console.log('[PaystackWebhook] Guest order marked as PAID:', reference)

        // Trigger fulfillment (async, don't await to avoid webhook timeout)
        triggerGuestFulfillment(order.id, order.network, order.phone_number, order.size, order.reference_code)
            .catch(err => console.error('[PaystackWebhook] Guest fulfillment error:', err))

    } catch (error) {
        console.error('[PaystackWebhook] processGuestOrderPayment error:', error)
    }
}

/**
 * Triggers data fulfillment for a guest order.
 * Same logic as /api/guest/purchase/verify.
 */
async function triggerGuestFulfillment(
    orderId: string,
    network: string,
    phoneNumber: string,
    size: string,
    referenceCode: string
) {
    const supabase = createServerClient()

    try {
        // AT-iShare: use SPFastIT API when auto-fulfillment is enabled
        if (network === 'AT-iShare') {
            const { data: setting } = await (supabase
                .from('admin_settings') as any)
                .select('value')
                .eq('key', 'ishare_auto_fulfillment_enabled')
                .single()

            if (setting?.value === 'true') {
                await fulfillIShareOrderWithTracking(orderId, phoneNumber, size, referenceCode, null)
                return
            }
            // Fall through to CodeCraft if setting is off
        }

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

            console.log('[PaystackWebhook] Guest fulfillment triggered successfully for order:', orderId)
        } else {
            console.error('[PaystackWebhook] Guest fulfillment failed for order:', orderId, (result as any).error)
        }
    } catch (err) {
        console.error('[PaystackWebhook] triggerGuestFulfillment error:', err)
    }
}
