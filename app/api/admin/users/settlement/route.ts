import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'

export async function POST(request: Request) {
    try {
        const { userId, requiresSettlement } = await request.json()

        if (!userId) {
            return NextResponse.json(
                { error: 'User ID is required' },
                { status: 400 }
            )
        }

        // Verify requester is admin
        const cookieStore = await cookies()
        // @ts-expect-error - auth-helpers types conflict with Next.js 15
        const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // Check if requester is admin or sub-admin
        const { data: requesterData, error: requesterError } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (requesterError || (requesterData?.role !== 'admin' && requesterData?.role !== 'sub-admin')) {
            return NextResponse.json(
                { error: 'Unauthorized - Admin access required' },
                { status: 403 }
            )
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
