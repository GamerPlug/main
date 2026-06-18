import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createServerClient } from '@/lib/supabase'

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
            const { reference, amount: paidAmountKobo, currency } = event.data

            const supabase = createServerClient()

            // Platform is authenticated-only: every payment is a wallet top-up
            // recorded in wallet_payments. (Guest checkout has been removed.)
            const { data: payment } = await supabase
                .from('wallet_payments')
                .select('total_amount, status')
                .eq('reference', reference)
                .single()

            if (!payment) {
                console.error('[PaystackWebhook] Payment not found in wallet_payments:', reference)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // Verify currency
            if (currency && currency !== 'GHS') {
                console.error(`[PaystackWebhook] CURRENCY MISMATCH for ${reference}: got ${currency}`)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            // Verify amount
            const expectedAmountKobo = Math.round((payment as any).total_amount * 100)
            if (paidAmountKobo !== expectedAmountKobo) {
                console.error(`[PaystackWebhook] AMOUNT MISMATCH for ${reference}: Expected ${expectedAmountKobo}, got ${paidAmountKobo}`)
                return NextResponse.json({ received: true }, { status: 200 })
            }

            const result = await processCompletedWalletPayment(reference, event.data)

            if (!result.success && !result.alreadyProcessed) {
                console.error('[PaystackWebhook] processCompletedWalletPayment FAILED:', reference, result.error)
            }
        }

        return NextResponse.json({ received: true }, { status: 200 })

    } catch (error) {
        console.error('[PaystackWebhook] Webhook error:', error)
        return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
    }
}
