import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function POST(request: Request) {
    try {
        const { userId, requiresSettlement } = await request.json()

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        // Verify requester is admin (server-verified getUser())
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        // Use service role client for the update (bypasses RLS)
        const supabaseAdmin = createServerClient()

        // Update user settlement status
        const { error: updateError } = await (supabaseAdmin
            .from('users') as any)
            .update({ 
                requires_settlement: requiresSettlement, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', userId)

        if (updateError) {
            console.error('Error updating settlement status:', updateError)
            return NextResponse.json(
                { error: `Failed to update settlement status: ${updateError.message}` },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Update settlement error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
