import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { sendOrderSuccessEmail, sendAdminNewOrderAlert } from '@/lib/email-service'
import { sendOrderSuccessSMS, sendAdminAgentOrderAlert } from '@/lib/sms-service'
import { fulfillIShareOrderWithTracking } from '@/lib/ishare-fulfillment'

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate API Key
        const { context, error: authError } = await validateApiKey(request)
        if (authError || !context) {
            return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 })
        }

        if (context.requiresSettlement) {
            return NextResponse.json({ 
                error: 'Account settlement required. Please contact admin to activate your API access.' 
            }, { status: 403 })
        }

        const { userId, role } = context

        // 2. Parse and Validate Request Body
        let body
        try {
            body = await request.json()
        } catch (e) {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
        }

        let { packageId, phoneNumber, idempotencyKey } = body

        if (!packageId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packageId)) {
            return NextResponse.json({ error: 'Invalid packageId format. Must be a valid UUID.' }, { status: 400 })
        }

        const phoneValidation = validateGhanaianPhone(phoneNumber)
        if (!phoneValidation.isValid) {
            return NextResponse.json({ error: phoneValidation.error || 'Invalid phoneNumber' }, { status: 400 })
        }
        phoneNumber = phoneValidation.normalizedNumber

        const supabase = createServerClient()

        // 3. Idempotency Check
        if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim() !== '') {
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id, reference_code, status')
                .eq('user_id', userId)
                .eq('idempotency_key', idempotencyKey)
                .single()

            if (existingOrder) {
                return NextResponse.json({
                    success: true,
                    order: {
                        id: existingOrder.id,
                        reference_code: existingOrder.reference_code,
                        status: existingOrder.status,
                    },
                    message: 'Order already exists (Idempotency hit)'
                })
            }
        }

        // 4. Get Package Details
        const { data: pkg, error: pkgError } = await supabase
            .from('data_packages')
            .select('*')
            .eq('id', packageId)
            .eq('is_available', true)
            .single()

        if (pkgError || !pkg) {
            return NextResponse.json({ error: 'Package not found or unavailable' }, { status: 404 })
        }

        // 5. Check Blacklist
        const { data: blacklisted } = await supabase
            .from('phone_blacklist')
            .select('id')
            .eq('phone_number', phoneNumber)
            .single()

        if (blacklisted) {
            return NextResponse.json({ error: 'This phone number is blacklisted and cannot receive orders' }, { status: 403 })
        }

        // 6. Fetch User Details for Notifications
        const { data: userData } = await supabase
            .from('users')
            .select('first_name, last_name, email, phone_number')
            .eq('id', userId)
            .single()

        // 7. Determine Price
        let priceToCharge = (pkg as any).price
        if (role === 'dealer' && (pkg as any).dealer_price > 0) priceToCharge = (pkg as any).dealer_price
        else if (role === 'agent' && (pkg as any).agent_price > 0) priceToCharge = (pkg as any).agent_price

        // 8. Atomic Wallet Deduction
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_wallet', {
            p_user_id: userId,
            p_amount: priceToCharge,
        })

        if (deductError || !(deductResult as any)?.success) {
            const errorMsg = (deductResult as any)?.error || deductError?.message || 'Wallet deduction failed'
            return NextResponse.json({ error: errorMsg }, { status: 400 })
        }

        const newBalance = (deductResult as any).new_balance
        const walletId = (deductResult as any).wallet_id
        const referenceCode = generateReferenceCode()

        // 9. Create Order
        const { data: order, error: orderError } = await (supabase
            .from('orders') as any)
            .insert({
                user_id: userId,
                package_id: packageId,
                phone_number: phoneNumber,
                network: (pkg as any).network,
                size: (pkg as any).size,
                price: priceToCharge,
                amount: priceToCharge,
                cost_price: (pkg as any).cost_price || 0,
                status: 'pending',
                payment_status: 'paid',
                reference_code: referenceCode,
                reference: referenceCode,
                fulfillment_method: 'auto',
                idempotency_key: idempotencyKey,
            })
            .select()
            .single()

        if (orderError) {
            console.error('API Order creation error:', orderError)
            await supabase.rpc('refund_wallet', { p_user_id: userId, p_amount: priceToCharge })
            return NextResponse.json({ error: 'Failed to create order. Wallet refunded.', _debug: orderError.message }, { status: 500 })
        }

        // 10. Record Transaction and Purchases
        await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: walletId,
            user_id: userId,
            type: 'debit',
            amount: priceToCharge,
            description: `API Data purchase: ${(pkg as any).size} for ${phoneNumber}`,
            reference: referenceCode,
            source: 'api',
            status: 'completed',
        })

        await updateUserPurchases(supabase, userId, phoneNumber, priceToCharge)

        // 11. Notifications (Async)
        await (supabase.from('notifications') as any).insert({
            user_id: userId,
            title: 'API Order Placed',
            message: `Your API order for ${(pkg as any).size} to ${phoneNumber} was successful.`,
            type: 'order_update',
            action_url: `/dashboard/my-orders`,
        })

        if (userData) {
            const firstName = (userData as any).first_name || 'User'
            const userEmail = (userData as any).email
            const accHolderPhone = (userData as any).phone_number

            // Emails
            if (role !== 'admin' && role !== 'sub-admin') {
                sendOrderSuccessEmail(userEmail, firstName, {
                    referenceCode, phoneNumber, network: (pkg as any).network, size: (pkg as any).size, price: priceToCharge
                }).catch(err => console.error('[API Order] User email error:', err))
            }

            sendAdminNewOrderAlert({
                referenceCode, phoneNumber, network: (pkg as any).network, size: (pkg as any).size, price: priceToCharge,
                userName: `${firstName} ${(userData as any).last_name || ''}`.trim(), userEmail
            }).catch(err => console.error('[API Order] Admin email error:', err))

            // SMS
            if (accHolderPhone) {
                sendOrderSuccessSMS(accHolderPhone, {
                    network: (pkg as any).network, size: (pkg as any).size, price: priceToCharge,
                    recipientNumber: phoneNumber, currentBalance: newBalance
                }).catch(err => console.error('[API Order] SMS error:', err))
            }

            if (['agent', 'super agent', 'dealer', 'super dealer', 'platinum'].includes(role)) {
                sendAdminAgentOrderAlert().catch(err => console.error('[API Order] Admin Agent SMS error:', err))
            }
        }

        triggerFulfillment((order as any).id, (pkg as any).network, phoneNumber, (pkg as any).size, referenceCode, userId)

        return NextResponse.json({
            success: true,
            order: {
                id: (order as any).id,
                reference_code: referenceCode,
                status: (order as any).status,
                amount: priceToCharge,
                network: (pkg as any).network,
                size: (pkg as any).size,
                phone: phoneNumber
            },
            new_balance: newBalance
        })

    } catch (error: any) {
        console.error('API Purchase error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

async function updateUserPurchases(supabase: any, userId: string, phone: string, amount: number) {
    const { data: existing } = await supabase.from('user_purchases').select('*').eq('user_id', userId).eq('user_phone', phone).single()
    if (existing) {
        await supabase.from('user_purchases').update({
            total_purchases: (existing as any).total_purchases + 1,
            total_spent: (existing as any).total_spent + amount,
            last_purchase_at: new Date().toISOString(),
        }).eq('id', (existing as any).id)
    } else {
        await supabase.from('user_purchases').insert({
            user_id: userId, user_phone: phone, total_purchases: 1, total_spent: amount,
            first_purchase_at: new Date().toISOString(), last_purchase_at: new Date().toISOString(),
        })
    }
}

async function triggerFulfillment(
    orderId: string,
    network: string,
    phone: string,
    size: string,
    referenceCode: string,
    userId: string
) {
    if (network === 'AT-iShare') {
        const supabase = createServerClient()
        const { data: setting } = await (supabase
            .from('admin_settings') as any)
            .select('value')
            .eq('key', 'ishare_auto_fulfillment_enabled')
            .single()

        if (setting?.value === 'true') {
            fulfillIShareOrderWithTracking(orderId, phone, size, referenceCode, userId)
                .catch((err) => console.error('[API v1 iShare] Auto-fulfill error:', err))
        }
    }
    // MTN and CodeCraft networks are fulfilled via their respective cron jobs
}
