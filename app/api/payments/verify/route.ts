import { NextRequest, NextResponse } from 'next/server'
import { processCompletedWalletPayment } from '@/lib/payments'
import { createServerClient } from '@/lib/supabase'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const reference = searchParams.get('reference')
        const isInline = request.headers.get('accept')?.includes('application/json')

        if (!reference) {
            if (isInline) {
                return NextResponse.json({ success: false, error: 'No reference provided' }, { status: 400 })
            }
            return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=no_reference`)
        }

        // Verify with Paystack
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
            console.error('[PaymentVerify] Paystack verification failed:', paystackData)

            const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=payment_failed` // Joseph: Simplified error URL

            if (isInline) {
                return NextResponse.json({ success: false, error: 'Payment verification failed', url: errorUrl }, { status: 400 })
            }
            return NextResponse.redirect(errorUrl)
        }

        // Defense-in-depth: confirm the paid amount + currency match the expected
        // wallet_payment record before crediting (parity with the webhook).
        const supabase = createServerClient()
        const { data: payment } = await supabase
            .from('wallet_payments')
            .select('total_amount')
            .eq('reference', reference)
            .single()

        const expectedKobo = payment ? Math.round(Number((payment as any).total_amount) * 100) : null
        const paidKobo = paystackData.data.amount
        const paidCurrency = paystackData.data.currency

        if (!payment || paidKobo !== expectedKobo || (paidCurrency && paidCurrency !== 'GHS')) {
            console.error('[PaymentVerify] Amount/currency mismatch:', { reference, paidKobo, expectedKobo, paidCurrency })
            const errorUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=amount_mismatch`
            if (isInline) {
                return NextResponse.json({ success: false, error: 'Payment amount mismatch', url: errorUrl }, { status: 400 })
            }
            return NextResponse.redirect(errorUrl)
        }

        // Regular wallet payment
        console.log('[PaymentVerify] Identified as REGULAR WALLET TOPUP')
        const result = await processCompletedWalletPayment(reference, paystackData.data)

        if (!result.success) {
            if (isInline) {
                return NextResponse.json({ success: false, error: result.error || 'Processing failed' }, { status: 500 })
            }
            return NextResponse.redirect(
                `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=${encodeURIComponent(result.error || 'processing_failed')}`
            )
        }

        if (isInline) {
            return NextResponse.json({ success: true, message: 'Payment successful' })
        }
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?success=true`
        )
    } catch (error) {
        console.error('[PaymentVerify] Verification error:', error)
        const isInline = request.headers.get('accept')?.includes('application/json')
        if (isInline) {
            return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
        }
        return NextResponse.redirect(
            `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/wallet?error=verification_failed`
        )
    }
}
