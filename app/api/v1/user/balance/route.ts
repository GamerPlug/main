import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    // 1. Authenticate API Key
    const { context, error } = await validateApiKey(request)
    if (error || !context) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })
    }

    if (context.requiresSettlement) {
        return NextResponse.json({ 
            error: 'Account settlement required. Please contact admin to activate your API access.' 
        }, { status: 403 })
    }

    const { userId } = context

    // 2. Fetch Wallet Balance
    const supabase = createServerClient()
    const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('balance, total_spent, updated_at')
        .eq('user_id', userId)
        .single()

    if (walletError || !wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 })
    }

    // 3. Return Balance
    return NextResponse.json({
        userId,
        balance: parseFloat(wallet.balance.toString()),
        total_spent: parseFloat(wallet.total_spent.toString()),
        currency: 'GHS',
        last_updated: wallet.updated_at
    })
}
