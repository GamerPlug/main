import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

// Service-role client for privileged writes (bypasses RLS)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function requireAdmin() {
    const supabase = createRouteClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { error: 'Unauthorized', status: 401 as const }

    const { data: user } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if ((user as any)?.role !== 'admin') return { error: 'Forbidden', status: 403 as const }
    return { adminId: session.user.id }
}

// GET — list all custom price overrides with user + package context
export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    let query = supabaseAdmin
        .from('user_package_pricing')
        .select(`
            id,
            user_id,
            package_id,
            custom_price,
            note,
            created_at,
            updated_at,
            users:user_id ( first_name, last_name, email, role ),
            data_packages:package_id ( network, size, price, dealer_price, agent_price )
        `)
        .order('created_at', { ascending: false })

    if (userId) query = query.eq('user_id', userId)

    const { data, error } = await query
    if (error) {
        console.error('User-pricing GET error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data || [])
}

// POST — upsert an override for (user_id, package_id)
export async function POST(request: NextRequest) {
    const auth = await requireAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { userId, packageId, customPrice, note } = body

    if (!userId || !UUID_RE.test(userId)) {
        return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 })
    }
    if (!packageId || !UUID_RE.test(packageId)) {
        return NextResponse.json({ error: 'Valid packageId is required' }, { status: 400 })
    }
    const price = Number(customPrice)
    if (!Number.isFinite(price) || price <= 0) {
        return NextResponse.json({ error: 'customPrice must be a positive number' }, { status: 400 })
    }

    const { data, error } = await (supabaseAdmin
        .from('user_package_pricing') as any)
        .upsert(
            {
                user_id: userId,
                package_id: packageId,
                custom_price: price,
                note: note || null,
                created_by: auth.adminId,
                updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,package_id' }
        )
        .select()
        .single()

    if (error) {
        console.error('User-pricing POST error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
}

// DELETE — remove an override by id
export async function DELETE(request: NextRequest) {
    const auth = await requireAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id || !UUID_RE.test(id)) {
        return NextResponse.json({ error: 'Valid id is required' }, { status: 400 })
    }

    const { error } = await supabaseAdmin
        .from('user_package_pricing')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('User-pricing DELETE error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
}
