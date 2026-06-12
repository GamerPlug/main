import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { generateKey, hashKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'

async function getSession() {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore
    })
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
}

export async function GET(request: NextRequest) {
    const { session, error: sessionError } = await getSession()

    if (sessionError || !session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: keys, error } = await supabase
        .from('api_keys')
        .select('id, name, key_preview, is_active, rate_limit_override, last_used_at, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(keys)
}

export async function POST(request: NextRequest) {
    const { session, error: sessionError } = await getSession()

    if (sessionError || !session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    const { name } = body
    if (!name || typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Key name is required' }, { status: 400 })
    }

    const newKey = generateKey()
    const hashedKey = await hashKey(newKey)
    // key format: easy_live_<32chars>  →  prefix = first 20 chars
    const prefix = newKey.substring(0, 20)
    const preview = `${newKey.substring(0, 16)}...${newKey.substring(newKey.length - 4)}`

    const supabase = createServerClient()
    const { data: key, error } = await supabase
        .from('api_keys')
        .insert({
            user_id: session.user.id,
            key_hash: hashedKey,
            key_prefix: prefix,
            key_preview: preview,
            name: name.trim(),
            is_active: true
        })
        .select('id, name, key_preview, is_active, rate_limit_override, last_used_at, created_at')
        .single()

    if (error) {
        console.error('[api-keys POST] Insert error:', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
        ...key,
        plain_text_key: newKey // Only returned once!
    })
}

export async function DELETE(request: NextRequest) {
    const { session, error: sessionError } = await getSession()

    if (sessionError || !session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

    const supabase = createServerClient()
    const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id) // scoped to owner — service role can delete any row

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
