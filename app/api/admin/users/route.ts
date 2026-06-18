import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')
        const search = searchParams.get('search')
        const role = searchParams.get('role')

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Add timeout to prevent hanging queries
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Database query timeout')), 10000)
        )

        let query = supabase
            .from('users')
            .select(`
                id,
                email,
                first_name,
                last_name,
                phone_number,
                role,
                status,
                requires_settlement,
                created_at,
                updated_at,
                wallets (
                    balance,
                    credit_limit,
                    unlimited_credit
                )
            `, { count: 'exact' })

        if (role && role !== 'all') {
            query = query.eq('role', role)
        }

        if (search) {
            // Strip characters that could escape the Supabase PostgREST filter syntax
            const safeSearch = search.replace(/[%_,()]/g, '').substring(0, 100)
            query = query.or(`email.ilike.%${safeSearch}%,first_name.ilike.%${safeSearch}%,last_name.ilike.%${safeSearch}%,phone_number.ilike.%${safeSearch}%`)
        }

        const fetchPromise = query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        const { data: users, count, error: fetchError } = await Promise.race([
            fetchPromise,
            timeoutPromise
        ]) as any

        if (fetchError) {
            console.error('[AdminUsersFetch] Database error:', fetchError)
            throw new Error(`Database query failed: ${fetchError.message}`)
        }

        return NextResponse.json({
            users: users || [],
            totalCount: count || 0
        })
    } catch (error: any) {
        console.error('Admin Users Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
