import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendOrderSuccessEmail, sendAdminNewOrderAlert } from '@/lib/email-service'
import { sendOrderSuccessSMS, sendAdminAgentOrderAlert } from '@/lib/sms-service'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { fulfillIShareOrderWithTracking } from '@/lib/ishare-fulfillment'
import { notifyAdmins, adminNewOrderNotification } from '@/lib/notification-service'

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            console.error('Order API: Unauthorized - Session error or missing user:', sessionError?.message)
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const user = session.user
        const userId = user.id

        let body;
        try {
            body = await request.json()
        } catch (e) {
            console.error('Order API: Failed to parse request body')
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        let { packageId, phoneNumber, idempotencyKey } = body

        if (!packageId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(packageId)) {
            return NextResponse.json({ error: 'Invalid package ID format' }, { status: 400 })
        }

        const phoneValidation = validateGhanaianPhone(phoneNumber)
        if (!phoneValidation.isValid) {
            return NextResponse.json({ error: phoneValidation.error || 'Invalid phone number' }, { status: 400 })
        }
        phoneNumber = phoneValidation.normalizedNumber

        // Service role client for privileged operations
        const supabase = createServerClient()

        // Idempotency check
        if (idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim() !== '') {
            const { data: existingOrder } = await supabase
                .from('orders')
                .select('id, reference_code, status')
                .eq('user_id', userId)
                .eq('idempotency_key', idempotencyKey)
                .single()

            if (existingOrder) {
                console.log(`Idempotency hit: Returning existing order ${existingOrder.id}`)
                return NextResponse.json({
                    success: true,
                    order: {
                        id: existingOrder.id,
                        reference_code: existingOrder.reference_code,
                        status: existingOrder.status,
                    },
                })
            }
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

        // Check if phone is blacklisted
        const { data: blacklisted } = await supabase
            .from('phone_blacklist')
            .select('id')
            .eq('phone_number', phoneNumber)
            .single()

        if (blacklisted) {
            return NextResponse.json({ error: 'This phone number is not allowed' }, { status: 400 })
        }


        // Get user profile for role and settlement status
        const { data: userData } = await supabase
            .from('users')
            .select('role, requires_settlement')
            .eq('id', userId)
            .single()

        if ((userData as any)?.requires_settlement) {
            return NextResponse.json({ 
                error: 'Account settlement required. Please contact admin to activate your account.' 
            }, { status: 403 })
        }

        const role = (userData as any)?.role || 'agent'

        // Determine price based on role
        let priceToCharge = (pkg as any).price
        if (role === 'dealer' && (pkg as any).dealer_price > 0) {
            priceToCharge = (pkg as any).dealer_price
        } else if (role === 'agent' && (pkg as any).agent_price > 0) {
            priceToCharge = (pkg as any).agent_price
        }
        // Joseph: Added dealer check
        // Atomic wallet deduction via RPC (prevents race conditions)
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_wallet', {
            p_user_id: userId,
            p_amount: priceToCharge,
        })

        if (deductError || !(deductResult as any)?.success) {
            const errorMsg = (deductResult as any)?.error || deductError?.message || 'Wallet deduction failed'
            if (errorMsg === 'Wallet not found') {
                return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
            }
            return NextResponse.json({ error: errorMsg }, { status: 400 })
        }

        const newBalance = (deductResult as any).new_balance
        const walletId = (deductResult as any).wallet_id

        const referenceCode = generateReferenceCode()

        // Create order
        const { data: order, error: orderError } = await (supabase
            .from('orders') as any)
            .insert({
                user_id: userId,
                package_id: packageId,
                phone_number: phoneNumber,
                network: (pkg as any).network,
                size: (pkg as any).size,
                price: priceToCharge,
                amount: priceToCharge, // Compatibility
                cost_price: (pkg as any).cost_price || 0,
                status: 'pending',
                payment_status: 'paid',
                reference_code: referenceCode,
                reference: referenceCode, // Compatibility
                fulfillment_method: 'auto',
                idempotency_key: idempotencyKey,
            })
            .select()
            .single()

        if (orderError) {
            console.error('Order creation error:', orderError)
            // Refund wallet since order creation failed
            await supabase.rpc('refund_wallet', {
                p_user_id: userId,
                p_amount: priceToCharge,
            })
            return NextResponse.json({
                error: 'Failed to create order. Wallet has been refunded.'
            }, { status: 500 })
        }

        // Create wallet transaction
        await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: walletId,
            user_id: userId,
            type: 'debit',
            amount: priceToCharge,
            description: `Data purchase: ${(pkg as any).size} for ${phoneNumber}`,
            reference: referenceCode,
            source: 'purchase',
            status: 'completed',
        })

        // Update user purchases
        await updateUserPurchases(supabase, userId!, phoneNumber, priceToCharge)

        // Create notification
        await (supabase.from('notifications') as any).insert({
            user_id: userId,
            title: 'Order Placed',
            message: `Your order for ${(pkg as any).size} to ${phoneNumber} has been placed and is being processed.`,
            type: 'order_update',
            action_url: `/dashboard/my-orders`,
        })

        // Notify admins of the new order (in-app + best-effort push)
        notifyAdmins(
            adminNewOrderNotification({
                orderRef: referenceCode,
                network: (pkg as any).network,
                size: (pkg as any).size,
                amount: priceToCharge,
                phone: phoneNumber,
            }),
            { excludeUserId: userId! },
        ).catch((e) => console.error('[OrderPurchase] Admin notify error:', e))

        // Send order confirmation email to user and admin alert (async, non-blocking)
        try {
            // Get user details for email and SMS
            const { data: userData } = await supabase
                .from('users')
                .select('email, first_name, last_name, phone_number, role')
                .eq('id', userId)
                .single()

            if (userData) {
                const userEmail = (userData as any).email
                const firstName = (userData as any).first_name || 'User'
                const lastName = (userData as any).last_name || ''
                const userRole = (userData as any).role

                // Send order success email to user (skip for admin/sub-admin)
                const isAdminUser = userRole === 'admin'
                if (!isAdminUser) {
                    sendOrderSuccessEmail(
                        userEmail,
                        firstName,
                        {
                            referenceCode,
                            phoneNumber,
                            network: (pkg as any).network,
                            size: (pkg as any).size,
                            price: priceToCharge
                        }
                    ).catch((err: Error) => console.error('[Order] User email error:', err))
                }

                // Send order success SMS to account holder
                const accountHolderPhone = (userData as any).phone_number
                if (accountHolderPhone) {
                    sendOrderSuccessSMS(
                        accountHolderPhone,
                        {
                            network: (pkg as any).network,
                            size: (pkg as any).size,
                            price: priceToCharge,
                            recipientNumber: phoneNumber,
                            currentBalance: newBalance
                        }
                    ).catch((err: Error) => console.error('[Order] SMS error:', err))
                }

                // Send new order alert to admin
                // Check if user is agent for SMS alert
                // We already checked userRoleData earlier
                const isAgentOrDealer = ['agent', 'dealer'].includes(userRole)
                if (isAgentOrDealer) {
                    sendAdminAgentOrderAlert()
                        .catch((err: Error) => console.error('[Order] Agent Admin SMS alert error:', err))
                }

                // Send new order alert to admin
                sendAdminNewOrderAlert({
                    referenceCode,
                    phoneNumber,
                    network: (pkg as any).network,
                    size: (pkg as any).size,
                    price: priceToCharge,
                    userName: `${firstName} ${lastName}`.trim(),
                    userEmail: userEmail
                }).catch((err: Error) => console.error('[Order] Admin email error:', err))
            }
        } catch (emailError) {
            console.error('[Order] Failed to send email notification:', emailError)
        }

        // Trigger auto-fulfillment (async, non-blocking)
        triggerFulfillment(
            (order as any).id,
            (pkg as any).network,
            phoneNumber,
            (pkg as any).size,
            referenceCode,
            userId
        )

        return NextResponse.json({
            success: true,
            order: {
                id: (order as any).id,
                reference_code: referenceCode,
                status: 'pending',
            },
        })
    } catch (error: any) {
        console.error('Purchase error:', error)
        return NextResponse.json({
            error: 'Internal server error'
        }, { status: 500 })
    }
}

async function updateUserPurchases(
    supabase: any,
    userId: string,
    phoneNumber: string,
    amount: number
) {
    const { data: existing } = await supabase
        .from('user_purchases')
        .select('*')
        .eq('user_id', userId)
        .eq('user_phone', phoneNumber)
        .single()

    if (existing) {
        await supabase
            .from('user_purchases')
            .update({
                total_purchases: existing.total_purchases + 1,
                total_spent: existing.total_spent + amount,
                last_purchase_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
    } else {
        await supabase.from('user_purchases').insert({
            user_id: userId,
            user_phone: phoneNumber,
            total_purchases: 1,
            total_spent: amount,
            first_purchase_at: new Date().toISOString(),
            last_purchase_at: new Date().toISOString(),
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
                .catch((err) => console.error('[iShare] Auto-fulfill error:', err))
        }
    }
    // MTN and CodeCraft networks rely on their respective cron jobs
}
