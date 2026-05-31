import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { calculatePaystackFee, generateReferenceCode } from '@/lib/utils'

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY!

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { packageId, phoneNumber, email, network } = body

        if (!packageId || !phoneNumber || !email) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // Service role client
        const supabase = createServerClient()

        // Check if guest purchase is enabled in admin settings
        const { data: guestPurchaseEnabledSetting } = await supabase
            .from('admin_settings')
            .select('value')
            .eq('key', 'guest_purchase_enabled')
            .single()

        if (guestPurchaseEnabledSetting?.value === 'false') {
            return NextResponse.json(
                { error: 'Guest purchases are temporarily unavailable. Please try again later.' },
                { status: 403 }
            )
        }

        // Get package details
        const { data: pkg, error: pkgError } = await supabase
            .from('data_packages')
            .select('*')
            .eq('id', packageId)
            .eq('is_available', true)
            .single()

        if (pkgError || !pkg) {
            return NextResponse.json({ error: 'Package not found' }, { status: 404 })
        }

        const priceToCharge = Number(pkg.price) || 0
        const feePercent = 1.95 // Default guest fee
        const fee = calculatePaystackFee(priceToCharge, feePercent)
        const totalAmount = priceToCharge + fee
        const reference = `GST-${generateReferenceCode()}`

        const amountInKobo = Math.round(totalAmount * 100)
        console.log('[GuestPurchase] Amount details:', { priceToCharge, fee, totalAmount, amountInKobo })

        // 1. Create a pending order first
        const { data: order, error: orderError } = await (supabase
            .from('orders') as any)
            .insert({
                user_id: null, // Guest order
                package_id: packageId,
                email: email,
                phone_number: phoneNumber,
                user_phone: phoneNumber,
                network: pkg.network,
                size: pkg.size,
                price: priceToCharge,
                amount: priceToCharge,
                status: 'pending',
                payment_status: 'unpaid',
                reference_code: reference,
                reference: reference,
                fulfillment_method: 'auto'
            })
            .select()
            .single()

        if (orderError) {
            console.error('[GuestPurchase] Order creation error details:', orderError)
            return NextResponse.json({
                error: 'Failed to create guest order',
                details: orderError.message
            }, { status: 500 })
        }

        console.log('[GuestPurchase] Order created. Initializing Paystack...')
        console.log('[GuestPurchase] Using Secret Key:', PAYSTACK_SECRET_KEY ? `${PAYSTACK_SECRET_KEY.substring(0, 5)}...` : 'MISSING')

        // 2. Initialize Paystack payment
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                amount: amountInKobo,
                currency: 'GHS',
                reference: reference,
                callback_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/guest/purchase/verify`,
                // Note: unique reference is sufficient for webhook lookup. 
                // Metadata removed to prevent "Authorization code not found" error from Paystack.
            }),
        })

        const paystackData = await paystackResponse.json()
        console.log('[GuestPurchase] Paystack Response:', JSON.stringify(paystackData))

        if (!paystackData.status) {
            console.error('[GuestPurchase] Paystack initialization error:', paystackData)
            return NextResponse.json({
                error: `Payment Gateway Error: ${paystackData.message}`,
                details: paystackData.message
            }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            authorization_url: paystackData.data.authorization_url,
            reference: reference,
        })

    } catch (error: any) {
        console.error('[GuestPurchase] Initialization error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
