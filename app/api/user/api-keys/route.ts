import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { generateKey, hashKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ 
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore 
    })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: keys, error } = await supabase
        .from('api_keys')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(keys)
}

export async function POST(request: NextRequest) {
    const cookieStore = await cookies()
    const supabaseUserClient = createRouteHandlerClient({ 
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore 
    })
    const { data: { session } } = await supabaseUserClient.auth.getSession()

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name } = body

    if (!name) return NextResponse.json({ error: 'Key name is required' }, { status: 400 })

    const newKey = generateKey()
    const hashedKey = await hashKey(newKey)
    const preview = `${newKey.substring(0, 10)}...${newKey.substring(newKey.length - 4)}`

    // Use service role to insert as RLS might be tricky for new keys depending on how it's set up
    const supabase = createServerClient()
    const { data: key, error } = await supabase
        .from('api_keys')
        .insert({
            user_id: session.user.id,
            key_hash: hashedKey,
            key_preview: preview,
            name: name,
            is_active: true
        })
        .select()
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
        ...key,
        plain_text_key: newKey // Only returned once!
    })
}

export async function DELETE(request: NextRequest) {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({ 
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore 
    })
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

    const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('user_id', session.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
