import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const db = createServerClient()
    const { data: keys, error } = await db
        .from('api_keys')
        .select(`
            id,
            user_id,
            name,
            key_preview,
            key_prefix,
            is_active,
            rate_limit_override,
            last_used_at,
            created_at,
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
    const auth = await requireAdmin()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const body = await request.json()
    const { id, is_active, rate_limit_override } = body

    if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

    const updateData: any = {}
    if (typeof is_active === 'boolean') updateData.is_active = is_active
    if (typeof rate_limit_override === 'number') updateData.rate_limit_override = rate_limit_override

    const db = createServerClient()
    const { data: updatedKey, error } = await db
        .from('api_keys')
        .update(updateData)
        .eq('id', id)
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(updatedKey)
}

export async function DELETE(request: NextRequest) {
    const auth = await requireAdmin()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

    const db = createServerClient()
    const { error } = await db
        .from('api_keys')
        .delete()
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
