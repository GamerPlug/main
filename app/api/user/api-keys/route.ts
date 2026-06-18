import { NextRequest, NextResponse } from 'next/server'
import { generateKey, hashKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'
import { requireUser } from '@/lib/admin-auth'
import { createNotification, apiKeyNotification } from '@/lib/notification-service'

export async function GET(request: NextRequest) {
    const auth = await requireUser()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const supabase = createServerClient()
    const { data: keys, error } = await supabase
        .from('api_keys')
        .select('id, name, key_preview, is_active, rate_limit_override, last_used_at, created_at')
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(keys)
}

export async function POST(request: NextRequest) {
    const auth = await requireUser()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
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
            user_id: auth.userId,
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

    await createNotification({
        userId: auth.userId,
        ...apiKeyNotification('created', name.trim()),
    }).catch((e) => console.error('[api-keys POST] Notification error:', e))

    return NextResponse.json({
        ...key,
        plain_text_key: newKey // Only returned once!
    })
}

export async function DELETE(request: NextRequest) {
    const auth = await requireUser()
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })

    const supabase = createServerClient()

    // Capture the key name (scoped to owner) before deleting, for the notification.
    const { data: existingKey } = await supabase
        .from('api_keys')
        .select('name')
        .eq('id', id)
        .eq('user_id', auth.userId)
        .maybeSingle()

    const { error } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', id)
        .eq('user_id', auth.userId) // scoped to owner — service role can delete any row

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (existingKey) {
        await createNotification({
            userId: auth.userId,
            ...apiKeyNotification('revoked', (existingKey as any).name || 'Unnamed key'),
        }).catch((e) => console.error('[api-keys DELETE] Notification error:', e))
    }

    return NextResponse.json({ success: true })
}
