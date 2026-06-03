import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendAdminNewOrderAlert } from '@/lib/email-service'
import { sendOrderSuccessSMS, sendAdminAgentOrderAlert } from '@/lib/sms-service'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { fulfillIShareOrderWithTracking } from '@/lib/ishare-fulfillment'

interface BulkOrderItem {
    packageId: string
    phoneNumber: string
    idempotencyKey: string
}

interface OrderResult {
    phoneNumber: string
    packageId: string
    success: boolean
    referenceCode?: string
    orderId?: string
    error?: string
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const userId = session.user.id

        let body: { orders: BulkOrderItem[] }
        try {
            body = await request.json()
        } catch (e) {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
        }

        const { orders } = body

        if (!orders || !Array.isArray(orders) || orders.length === 0) {
            return NextResponse.json({ error: 'No orders provided' }, { status: 400 })
        }

        if (orders.length > 5000) {
            return NextResponse.json({ error: 'Maximum 5,000 orders per batch' }, { status: 400 })
        }

        // Service role client for privileged operations
        const supabase = createServerClient()

        const { data: userData } = await supabase
            .from('users')
            .select('role, email, first_name, last_name, phone_number, requires_settlement')
            .eq('id', userId)
            .single()

        const userRole = (userData as any)?.role
        const isSpecialRole = ['admin', 'dealer', 'agent'].includes(userRole)

        if (!userData || !isSpecialRole) {
            return NextResponse.json({ error: 'Bulk orders are only available for agents and dealers' }, { status: 403 })
        }

        if ((userData as any).requires_settlement) {
            return NextResponse.json({
                error: 'Account settlement required. Please contact admin to activate your account.'
            }, { status: 403 })
        }

        const userEmail = (userData as any).email
        const firstName = (userData as any).first_name || 'Agent'
        const lastName = (userData as any).last_name || ''
        const accountHolderPhone = (userData as any).phone_number

        // --- Phase 1: Validate all orders upfront ---

        const uniquePackageIds = [...new Set(orders.map(o => o.packageId))]
        const { data: packagesData, error: pkgError } = await supabase
            .from('data_packages')
            .select('*')
            .in('id', uniquePackageIds)
            .eq('is_available', true)

        if (pkgError) {
            return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 })
        }

        const packageMap = new Map((packagesData || []).map(p => [(p as any).id, p]))

        // Normalize and validate phones server-side, then batch-check blacklist
        const normalizedPhones = new Map<string, string>() // raw → normalized
        for (const order of orders) {
            const phoneVal = validateGhanaianPhone(order.phoneNumber)
            if (phoneVal.isValid) {
                normalizedPhones.set(order.phoneNumber, phoneVal.normalizedNumber)
            }
        }

        const uniqueNormalized = [...new Set(normalizedPhones.values())]
        const { data: blacklistedPhones } = await supabase
            .from('phone_blacklist')
            .select('phone_number')
            .in('phone_number', uniqueNormalized)

        const blacklistSet = new Set((blacklistedPhones || []).map((b: any) => b.phone_number))

        // Check idempotency for all orders
        const idempotencyKeys = orders.map(o => o.idempotencyKey).filter(Boolean)
        let existingOrderMap = new Map<string, any>()
        if (idempotencyKeys.length > 0) {
            const { data: existingOrders } = await supabase
                .from('orders')
                .select('id, reference_code, status, idempotency_key')
                .in('idempotency_key', idempotencyKeys)

            if (existingOrders) {
                existingOrderMap = new Map(existingOrders.map((o: any) => [o.idempotency_key, o]))
            }
        }

        const validatedOrders: {
            order: BulkOrderItem
            pkg: any
            price: number
            referenceCode: string
        }[] = []
        const results: OrderResult[] = []
        let totalCost = 0

        for (const order of orders) {
            // Idempotency check
            const existing = existingOrderMap.get(order.idempotencyKey)
            if (existing) {
                results.push({
                    phoneNumber: order.phoneNumber,
                    packageId: order.packageId,
                    success: true,
                    referenceCode: existing.reference_code,
                    orderId: existing.id,
                })
                continue
            }

            // Server-side phone validation
            const phoneVal = validateGhanaianPhone(order.phoneNumber)
            if (!phoneVal.isValid) {
                results.push({
                    phoneNumber: order.phoneNumber,
                    packageId: order.packageId,
                    success: false,
                    error: phoneVal.error || 'Invalid phone number',
                })
                continue
            }
            const normalizedPhone = phoneVal.normalizedNumber

            const pkg = packageMap.get(order.packageId)
            if (!pkg) {
                results.push({
                    phoneNumber: normalizedPhone,
                    packageId: order.packageId,
                    success: false,
                    error: 'Package not found or unavailable',
                })
                continue
            }

            if (blacklistSet.has(normalizedPhone)) {
                results.push({
                    phoneNumber: normalizedPhone,
                    packageId: order.packageId,
                    success: false,
                    error: 'Phone number is blacklisted',
                })
                continue
            }

            let price = (pkg as any).price
            if (userRole === 'dealer' && (pkg as any).dealer_price > 0) {
                price = (pkg as any).dealer_price
            } else if (userRole === 'agent' && (pkg as any).agent_price > 0) {
                price = (pkg as any).agent_price
            }

            const referenceCode = generateReferenceCode()
            validatedOrders.push({ order: { ...order, phoneNumber: normalizedPhone }, pkg, price, referenceCode })
            totalCost += price
        }

        if (validatedOrders.length === 0) {
            return NextResponse.json({
                success: true,
                results,
                summary: {
                    total: orders.length,
                    succeeded: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                }
            })
        }

        // --- Phase 2: Atomic wallet deduction ---
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_wallet', {
            p_user_id: userId,
            p_amount: totalCost,
        })

        if (deductError || !(deductResult as any)?.success) {
            const errorMsg = (deductResult as any)?.error || deductError?.message || 'Wallet deduction failed'
            for (const vo of validatedOrders) {
                results.push({
                    phoneNumber: vo.order.phoneNumber,
                    packageId: vo.order.packageId,
                    success: false,
                    error: errorMsg,
                })
            }
            return NextResponse.json({
                success: false,
                error: errorMsg,
                results,
                summary: {
                    total: orders.length,
                    succeeded: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                }
            })
        }

        const newBalance = (deductResult as any).new_balance
        const walletId = (deductResult as any).wallet_id

        // --- Phase 3: Batch insert orders ---
        const orderInserts = validatedOrders.map(vo => ({
            user_id: userId,
            package_id: vo.order.packageId,
            phone_number: vo.order.phoneNumber,
            network: (vo.pkg as any).network,
            size: (vo.pkg as any).size,
            bundle_name: (vo.pkg as any).size,
            price: vo.price,
            amount: vo.price,
            cost_price: (vo.pkg as any).cost_price || 0,
            status: 'pending',
            payment_status: 'paid',
            reference_code: vo.referenceCode,
            reference: vo.referenceCode,
            fulfillment_method: 'auto',
            idempotency_key: vo.order.idempotencyKey,
        }))

        const { data: insertedOrders, error: insertError } = await (supabase
            .from('orders') as any)
            .insert(orderInserts)
            .select()

        if (insertError || !insertedOrders) {
            console.error('Bulk order insert error:', insertError)
            await supabase.rpc('refund_wallet', {
                p_user_id: userId,
                p_amount: totalCost,
            })
            for (const vo of validatedOrders) {
                results.push({
                    phoneNumber: vo.order.phoneNumber,
                    packageId: vo.order.packageId,
                    success: false,
                    error: 'Failed to create order',
                })
            }
            return NextResponse.json({
                success: false,
                error: 'Failed to create orders. Wallet has been refunded.',
                results,
                summary: {
                    total: orders.length,
                    succeeded: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                }
            }, { status: 500 })
        }

        // --- Phase 4: Wallet transactions, notifications, user_purchases ---
        const walletTransactions = validatedOrders.map(vo => ({
            wallet_id: walletId,
            user_id: userId,
            type: 'debit',
            amount: vo.price,
            description: `Data purchase: ${(vo.pkg as any).size} for ${vo.order.phoneNumber}`,
            reference: vo.referenceCode,
            source: 'purchase',
            status: 'completed',
        }))
        await (supabase.from('wallet_transactions') as any).insert(walletTransactions)

        const notifications = validatedOrders.map(vo => ({
            user_id: userId,
            title: 'Order Placed',
            message: `Your order for ${(vo.pkg as any).size} to ${vo.order.phoneNumber} has been placed and is being processed.`,
            type: 'order_update',
            action_url: '/dashboard/my-orders',
        }))
        await (supabase.from('notifications') as any).insert(notifications)

        // Update user_purchases per unique phone
        const phoneAmounts = new Map<string, number>()
        for (const vo of validatedOrders) {
            phoneAmounts.set(vo.order.phoneNumber, (phoneAmounts.get(vo.order.phoneNumber) || 0) + vo.price)
        }
        for (const [phone, amount] of phoneAmounts) {
            const purchaseCount = validatedOrders.filter(vo => vo.order.phoneNumber === phone).length
            const { data: existing } = await supabase
                .from('user_purchases')
                .select('*')
                .eq('user_id', userId)
                .eq('user_phone', phone)
                .single()
            if (existing) {
                await supabase
                    .from('user_purchases')
                    .update({
                        total_purchases: (existing as any).total_purchases + purchaseCount,
                        total_spent: (existing as any).total_spent + amount,
                        last_purchase_at: new Date().toISOString(),
                    })
                    .eq('id', (existing as any).id)
            } else {
                await (supabase.from('user_purchases') as any).insert({
                    user_id: userId,
                    user_phone: phone,
                    total_purchases: purchaseCount,
                    total_spent: amount,
                    first_purchase_at: new Date().toISOString(),
                    last_purchase_at: new Date().toISOString(),
                })
            }
        }

        for (let i = 0; i < validatedOrders.length; i++) {
            const vo = validatedOrders[i]
            const insertedOrder = insertedOrders[i]
            results.push({
                phoneNumber: vo.order.phoneNumber,
                packageId: vo.order.packageId,
                success: true,
                referenceCode: vo.referenceCode,
                orderId: (insertedOrder as any)?.id,
            })
        }

        // --- Phase 5: Notifications and fulfillment (async, non-blocking) ---
        try {
            if (['agent', 'dealer'].includes(userRole)) {
                sendAdminAgentOrderAlert()
                    .catch((err: Error) => console.error('[BulkOrder] Agent admin SMS alert error:', err))
            }
            sendAdminNewOrderAlert({
                referenceCode: `BULK-${validatedOrders.length}-orders`,
                phoneNumber: `${validatedOrders.length} recipients`,
                network: 'Multiple',
                size: `${validatedOrders.length} packages`,
                price: totalCost,
                userName: `${firstName} ${lastName}`.trim(),
                userEmail,
            }).catch((err: Error) => console.error('[BulkOrder] Admin email error:', err))

            if (accountHolderPhone) {
                sendOrderSuccessSMS(accountHolderPhone, {
                    network: 'Bulk',
                    size: `${validatedOrders.length} orders`,
                    price: totalCost,
                    recipientNumber: `${validatedOrders.length} numbers`,
                    currentBalance: newBalance,
                }).catch((err: Error) => console.error('[BulkOrder] SMS error:', err))
            }
        } catch (notifyError) {
            console.error('[BulkOrder] Notification error:', notifyError)
        }

        // Trigger auto-fulfillment for AT-iShare orders
        for (let i = 0; i < insertedOrders.length; i++) {
            const insertedOrder = insertedOrders[i]
            const vo = validatedOrders[i]
            triggerFulfillment(
                (insertedOrder as any).id,
                (insertedOrder as any).network,
                vo.order.phoneNumber,
                (vo.pkg as any).size,
                vo.referenceCode,
                userId
            )
        }

        return NextResponse.json({
            success: true,
            results,
            newBalance,
            summary: {
                total: orders.length,
                succeeded: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                totalCost,
            }
        })

    } catch (error: any) {
        console.error('Bulk purchase error:', error)
        return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
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
                .catch((err: Error) => console.error('[BulkOrder] iShare auto-fulfill error:', err))
        }
    }
    // MTN and other networks rely on cron jobs
}
