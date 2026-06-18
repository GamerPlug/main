import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { sendWalletTopupSuccessEmail } from '@/lib/email-service'
import { sendWalletTopupSuccessSMS } from '@/lib/sms-service'
import { createNotification, balanceUpdatedNotification } from '@/lib/notification-service'

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }
        // Manual wallet adjustments are restricted to full admins.
        if (auth.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, amount, type, description } = body

        if (!userId || amount === undefined || !type) {
            return NextResponse.json({ error: 'userId, amount, and type are required' }, { status: 400 })
        }

        const adjustmentAmount = parseFloat(amount)
        if (isNaN(adjustmentAmount) || adjustmentAmount <= 0) {
            return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
        }

        if (adjustmentAmount > 50000) {
            return NextResponse.json({ error: 'Adjustment amount exceeds maximum allowed (GHS 50,000)' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // CHECK ENV VAR
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY is MISSING in environment variables!')
        }

        // 1. Get wallet
        let { data: wallet, error: walletFetchError } = await supabase
            .from('wallets')
            .select('id, balance, total_credited, total_spent, credit_limit')
            .eq('user_id', userId)
            .single()

        if (walletFetchError || !wallet) {
            console.log('[AdminWalletAdjustment] Wallet not found, attempting to create one for user:', userId)

            // Check if user exists first
            const { data: userExists } = await supabase
                .from('users')
                .select('id')
                .eq('id', userId)
                .single()

            if (!userExists) {
                return NextResponse.json({ error: 'User record not found in database. Please ensure user is onboarded.' }, { status: 404 })
            }

            // Create wallet
            const { data: newWallet, error: createError } = await (supabase
                .from('wallets') as any)
                .insert({
                    user_id: userId,
                    balance: 0,
                    total_credited: 0,
                    total_spent: 0
                })
                .select()
                .single()

            if (createError) {
                console.error('[AdminWalletAdjustment] Failed to create wallet:', createError)
                return NextResponse.json({
                    error: 'Failed to create wallet for user',
                    details: createError.message,
                    code: createError.code
                }, { status: 500 })
            }

            wallet = newWallet
        }

        const isCredit = type === 'credit'

        // 2. Atomic balance change (row-locked RPC; prevents concurrent-update races)
        const { data: adjustResult, error: adjustError } = await (supabase as any).rpc('adjust_wallet_balance', {
            p_user_id: userId,
            p_amount: adjustmentAmount,
            p_type: isCredit ? 'credit' : 'debit',
        })

        if (adjustError || !(adjustResult as any)?.success) {
            const msg = (adjustResult as any)?.error || adjustError?.message || 'Wallet adjustment failed'
            const status = msg === 'Insufficient balance' ? 400 : 500
            return NextResponse.json({ error: msg }, { status })
        }

        const newBalance = (adjustResult as any).new_balance

        // 3. Log transaction
        const { error: transError } = await (supabase.from('wallet_transactions') as any).insert({
            wallet_id: (wallet as any).id,
            user_id: userId,
            type: type,
            amount: adjustmentAmount,
            description: description || 'Admin manual adjustment',
            source: 'admin',
            status: 'completed'
        })

        if (transError) {
            console.error('[AdminWalletAdjustment] Transaction log error:', transError)
        }

        // 4. Send notification (in-app + best-effort web push)
        await createNotification({
            userId,
            ...balanceUpdatedNotification(adjustmentAmount, isCredit ? 'credit' : 'debit', description || undefined),
        }).catch((e) => console.error('[AdminWalletAdjustment] Notification error:', e))

        if (type === 'credit') {
            const { data: user } = await supabase
                .from('users')
                .select('email, first_name, phone_number')
                .eq('id', userId)
                .single()

            if (user) {
                const reference = `MNL-${Date.now()}`

                await sendWalletTopupSuccessEmail(
                    (user as any).email,
                    (user as any).first_name || 'User',
                    adjustmentAmount,
                    reference,
                    newBalance
                )

                if ((user as any).phone_number) {
                    try {
                        await sendWalletTopupSuccessSMS(
                            (user as any).phone_number,
                            { amount: adjustmentAmount, newBalance }
                        )
                    } catch (smsError: any) {
                        console.error('[AdminWalletAdjustment] SMS failed:', smsError.message)
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            newBalance,
        })

    } catch (error: any) {
        console.error('Admin Wallet Adjustment Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
