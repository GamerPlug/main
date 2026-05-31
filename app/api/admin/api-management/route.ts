import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ 
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore 
    })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user is admin
    const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'sub-admin')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data: keys, error } = await supabase
        .from('api_keys')
        .select(`
            *,
            users (
                email,
                first_name,
                last_name,
                role
            )
        `)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(keys)
}

export async function PATCH(request: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ 
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore 
    })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user is admin
    const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'sub-admin')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { id, is_active, rate_limit_override } = body

    if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

    const updateData: any = {}
    if (typeof is_active === 'boolean') updateData.is_active = is_active
    if (typeof rate_limit_override === 'number') updateData.rate_limit_override = rate_limit_override

    const { data: updatedKey, error } = await supabase
        .from('api_keys')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(updatedKey)
}

export async function DELETE(request: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ 
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore 
    })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user is admin
    const { data: userProfile } = await supabase
        .from('users')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if (!userProfile || (userProfile.role !== 'admin' && userProfile.role !== 'sub-admin')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

    const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
