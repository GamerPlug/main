import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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

        // Check if requester is admin/sub-admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin' && userData?.role !== 'sub-admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, creditLimit, unlimitedCredit } = body

        if (!userId || creditLimit === undefined) {
            return NextResponse.json({ error: 'userId and creditLimit are required' }, { status: 400 })
        }

        const limit = parseFloat(creditLimit)
        if (isNaN(limit) || (!unlimitedCredit && limit < 0)) {
            return NextResponse.json({ error: 'Invalid credit limit' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // 1. Get wallet
        let { data: wallet, error: walletFetchError } = await supabase
            .from('wallets')
            .select('id')
            .eq('user_id', userId)
            .single()

        if (walletFetchError || !wallet) {
            // Create wallet if not found
            const { data: newWallet, error: createError } = await (supabase
                .from('wallets') as any)
                .insert({
                    user_id: userId,
                    balance: 0,
                    credit_limit: limit,
                    unlimited_credit: !!unlimitedCredit
                })
                .select()
                .single()

            if (createError) {
                return NextResponse.json({ error: 'Failed to create/update wallet', details: createError.message }, { status: 500 })
            }
        } else {
            // Update existing wallet
            const { error: updateError } = await (supabase
                .from('wallets') as any)
                .update({ 
                    credit_limit: limit,
                    unlimited_credit: !!unlimitedCredit
                })
                .eq('id', wallet.id)

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update credit limit', details: updateError.message }, { status: 500 })
            }
        }

        // 3. Log notification for the user
        await (supabase.from('notifications') as any).insert({
            user_id: userId,
            title: 'Credit Limit Updated',
            message: unlimitedCredit 
                ? 'Your credit status has been updated to Unlimited (Free Range).'
                : `Your credit limit has been set to GHS ${limit.toFixed(2)}.`,
            type: 'system',
            is_read: false
        })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Admin Credit Limit Update Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
