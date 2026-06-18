import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'
import { sendWalletTopupSuccessEmail } from '@/lib/email-service'
import { sendWalletTopupSuccessSMS } from '@/lib/sms-service'

export async function POST(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }

        // Server-side (service role) to bypass RLS and perform atomic updates
        const supabase = createServerClient()

        // 1. Fetch user details (for notifications)
        const { data: user } = await supabase
            .from('users')
            .select('first_name, email, phone_number')
            .eq('id', userId)
            .single()

        // 2. Atomically zero a negative balance and clear the settlement flag
        //    (row-locked RPC; avoids a race against concurrent debits).
        const { data: settleResult, error: settleError } = await (supabase as any).rpc('settle_wallet_to_zero', {
            p_user_id: userId,
        })

        if (settleError || !(settleResult as any)?.success) {
            const msg = (settleResult as any)?.error || settleError?.message || 'Settlement failed'
            return NextResponse.json({ error: msg }, { status: msg === 'Wallet not found' ? 404 : 500 })
        }

        const walletId = (settleResult as any).wallet_id
        const settlementAmount = Number((settleResult as any).settled_amount) || 0

        // 4. Log Transaction (only if there was a debt to settle)
        if (settlementAmount > 0) {
            await (supabase.from('wallet_transactions') as any).insert({
                wallet_id: walletId,
                user_id: userId,
                type: 'credit',
                amount: settlementAmount,
                description: 'Debt settlement & account reactivation (Auto-Zero)',
                source: 'admin',
                status: 'completed'
            })

            // 5. Send Notifications
            if (user) {
                // Toasts/Local notifications handled by Realtime + UI
                await supabase.from('notifications').insert({
                    user_id: userId,
                    title: 'Account Reactivated',
                    message: `Your account has been reactivated. Your balance was settled to GHS 0.00.`,
                    type: 'balance_updated'
                })

                // Email & SMS (Best effort)
                try {
                    await sendWalletTopupSuccessEmail(user.email, user.first_name || 'User', settlementAmount, `SETTLE-${Date.now()}`, 0)
                    if (user.phone_number) {
                        await sendWalletTopupSuccessSMS(user.phone_number, { amount: settlementAmount, newBalance: 0 })
                    }
                } catch (err) {
                    console.error('[SettlementAPI] Notification error:', err)
                }
            }
        }

        return NextResponse.json({ 
            success: true, 
            settledAmount: settlementAmount,
            newBalance: 0
        })

    } catch (error: any) {
        console.error('Settlement API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
