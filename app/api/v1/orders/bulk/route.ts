import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'
import { generateReferenceCode } from '@/lib/utils'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { getBulkOrderRatelimit } from '@/lib/rate-limit'
import { resolvePackagePrice, getUserPriceOverrides } from '@/lib/pricing'

const MAX_BULK_SIZE = 100

interface BulkOrderItem {
    packageId: string
    phoneNumber: string
    idempotencyKey?: string
}

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

        const { userId, role, apiKeyId } = context

        // 2. Bulk-specific rate limit (5 requests/min per API key)
        try {
            const bulkLimiter = getBulkOrderRatelimit()
            const { success, limit, remaining, reset } = await bulkLimiter.limit(apiKeyId)
            if (!success) {
                const retryAfter = Math.ceil((reset - Date.now()) / 1000)
                return NextResponse.json(
                    { error: `Bulk rate limit exceeded. Max ${limit} bulk requests per minute. Retry in ${retryAfter}s.` },
                    {
                        status: 429,
                        headers: {
                            'X-RateLimit-Limit': String(limit),
                            'X-RateLimit-Remaining': String(remaining),
                            'Retry-After': String(retryAfter),
                        }
                    }
                )
            }
        } catch (redisErr) {
            console.error('[bulk] Rate limit error:', redisErr)
        }

        // 3. Parse and validate request body
        let body: any
        try {
            body = await request.json()
        } catch {
            return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 })
        }

        const { orders } = body

        if (!Array.isArray(orders) || orders.length === 0) {
            return NextResponse.json({ error: '"orders" must be a non-empty array' }, { status: 400 })
        }

        if (orders.length > MAX_BULK_SIZE) {
            return NextResponse.json(
                { error: `Maximum ${MAX_BULK_SIZE} orders per bulk request. Received ${orders.length}.` },
                { status: 400 }
            )
        }

        const supabase = createServerClient()

        // 4. Pre-validate all items before processing any
        const validationErrors: { index: number; error: string }[] = []
        const validatedItems: BulkOrderItem[] = []

        for (let i = 0; i < orders.length; i++) {
            const item = orders[i]

            if (!item.packageId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.packageId)) {
                validationErrors.push({ index: i, error: 'Invalid packageId format — must be a valid UUID' })
                continue
            }

            const phoneValidation = validateGhanaianPhone(item.phoneNumber)
            if (!phoneValidation.isValid) {
                validationErrors.push({ index: i, error: phoneValidation.error || 'Invalid phoneNumber' })
                continue
            }

            validatedItems.push({
                packageId: item.packageId,
                phoneNumber: phoneValidation.normalizedNumber!,
                idempotencyKey: item.idempotencyKey,
            })
        }

        if (validationErrors.length > 0) {
            return NextResponse.json({
                error: 'Validation failed for one or more items',
                validation_errors: validationErrors,
            }, { status: 400 })
        }

        // 5. Fetch all unique packages in one query
        const packageIds = [...new Set(validatedItems.map(o => o.packageId))]
        const { data: packages, error: pkgError } = await supabase
            .from('data_packages')
            .select('*')
            .in('id', packageIds)
            .eq('is_available', true)

        if (pkgError || !packages) {
            return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 })
        }

        const pkgMap = new Map(packages.map((p: any) => [p.id, p]))

        // Per-user custom price overrides (apply regardless of role)
        const priceOverrides = await getUserPriceOverrides(supabase, userId, packageIds)

        // Verify all packages exist
        for (let i = 0; i < validatedItems.length; i++) {
            if (!pkgMap.has(validatedItems[i].packageId)) {
                return NextResponse.json({
                    error: `Package at index ${i} (id: ${validatedItems[i].packageId}) not found or unavailable`,
                }, { status: 404 })
            }
        }

        // 6. Calculate total cost
        let totalCost = 0
        for (const item of validatedItems) {
            const pkg = pkgMap.get(item.packageId) as any
            totalCost += resolvePackagePrice(pkg, role, priceOverrides)
        }

        // 7. Single atomic wallet deduction for total
        const { data: deductResult, error: deductError } = await supabase.rpc('deduct_wallet', {
            p_user_id: userId,
            p_amount: totalCost,
        })

        if (deductError || !(deductResult as any)?.success) {
            const msg = (deductResult as any)?.error || deductError?.message || 'Wallet deduction failed'
            return NextResponse.json({ error: msg }, { status: 400 })
        }

        const newBalance = (deductResult as any).new_balance
        const walletId = (deductResult as any).wallet_id

        // 8. Create all orders
        const orderInserts: any[] = []
        const refCodes: string[] = []

        for (const item of validatedItems) {
            const pkg = pkgMap.get(item.packageId) as any
            const price = resolvePackagePrice(pkg, role, priceOverrides)

            const refCode = generateReferenceCode()
            refCodes.push(refCode)

            orderInserts.push({
                user_id: userId,
                package_id: item.packageId,
                phone_number: item.phoneNumber,
                network: pkg.network,
                size: pkg.size,
                price,
                amount: price,
                cost_price: pkg.cost_price || 0,
                status: 'pending',
                payment_status: 'paid',
                reference_code: refCode,
                reference: refCode,
                fulfillment_method: 'auto',
                idempotency_key: item.idempotencyKey || null,
            })
        }

        const { data: createdOrders, error: orderError } = await (supabase
            .from('orders') as any)
            .insert(orderInserts)
            .select('id, reference_code, status, network, size, amount, phone_number')

        if (orderError) {
            console.error('[bulk] Order insert error:', orderError)
            await supabase.rpc('refund_wallet', { p_user_id: userId, p_amount: totalCost })
            return NextResponse.json({ error: 'Failed to create orders. Wallet refunded.' }, { status: 500 })
        }

        // 9. Record wallet transactions
        const txInserts = (createdOrders as any[]).map((order: any, i: number) => ({
            wallet_id: walletId,
            user_id: userId,
            type: 'debit',
            amount: order.amount,
            description: `Bulk API order: ${order.size} for ${order.phone_number}`,
            reference: order.reference_code,
            source: 'api_bulk',
            status: 'completed',
        }))

        await (supabase.from('wallet_transactions') as any).insert(txInserts)

        // MTN and other networks are fulfilled via their respective cron jobs.

        return NextResponse.json({
            success: true,
            summary: {
                total_orders: (createdOrders as any[]).length,
                total_charged: totalCost,
                new_balance: newBalance,
            },
            orders: (createdOrders as any[]).map((o: any) => ({
                id: o.id,
                reference_code: o.reference_code,
                status: o.status,
                network: o.network,
                size: o.size,
                amount: parseFloat(o.amount.toString()),
                phone: o.phone_number,
            })),
        })

    } catch (error: any) {
        console.error('[bulk] Unexpected error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
