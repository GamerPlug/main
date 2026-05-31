import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendWalletTopupSuccessEmail } from '@/lib/email-service'
import { sendWalletTopupSuccessSMS } from '@/lib/sms-service'

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

        // Check if requester is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId } = body

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 })
        }

        // Server-side (service role) to bypass RLS and perform atomic updates
        const supabase = createServerClient()

        // 1. Get wallet and user status
        const [walletRes, userRes] = await Promise.all([
            supabase.from('wallets').select('*').eq('user_id', userId).single(),
            supabase.from('users').select('first_name, email, phone_number, requires_settlement').eq('id', userId).single()
        ])

        if (walletRes.error || !walletRes.data) {
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
        }

        const wallet = walletRes.data
        const user = userRes.data
        const currentBalance = Number(wallet.balance) || 0
        const settlementAmount = currentBalance < 0 ? Math.abs(currentBalance) : 0

        // 2. Perform Atomic Update
        // We credit the balance to exactly 0 (if negative) and clear the flag
        const { data: updatedWallet, error: updateError } = await (supabase.from('wallets') as any)
            .update({ 
                balance: 0, 
                total_credited: (Number(wallet.total_credited) || 0) + settlementAmount,
                updated_at: new Date().toISOString()
            })
            .eq('id', wallet.id)
            .select()
            .single()

        if (updateError) throw updateError

        // 3. Clear settlement flag on user
        const { error: userUpdateError } = await (supabase.from('users') as any)
            .update({ requires_settlement: false })
            .eq('id', userId)

        if (userUpdateError) console.error('[SettlementAPI] Failed to clear flag:', userUpdateError)

        // 4. Log Transaction (only if there was a debt to settle)
        if (settlementAmount > 0) {
            await (supabase.from('wallet_transactions') as any).insert({
                wallet_id: wallet.id,
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
