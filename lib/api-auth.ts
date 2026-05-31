import { createServerClient } from './supabase'
import { crypto } from 'next/dist/compiled/@edge-runtime/primitives'

export interface ApiAuthContext {
    userId: string
    role: string
    apiKeyId: string
    rateLimit: number
    requiresSettlement: boolean
}

/**
 * Validates an API key from the Authorization header.
 * Implementation:
 * 1. Extract Bearer token.
 * 2. Hash the token using SHA-256.
 * 3. Query the api_keys table for the hash.
 * 4. Verify the key is active and check rate limits.
 */
export async function validateApiKey(request: Request): Promise<{ context: ApiAuthContext | null, error: string | null }> {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { context: null, error: 'Missing or invalid Authorization header. Use "Bearer <your_api_key>"' }
    }

    const apiKey = authHeader.substring(7)
    if (!apiKey) {
        return { context: null, error: 'API key is missing' }
    }

    // 1. Hash the API key
    const hashAsBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(apiKey)
    )
    const hashHex = Array.from(new Uint8Array(hashAsBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

    // 2. Query Supabase (using service role to bypass RLS for auth check)
    const supabase = createServerClient()
    const { data: keyData, error: dbError } = await supabase
        .from('api_keys')
        .select(`
            id,
            user_id,
            is_active,
            rate_limit_override,
            last_used_at,
            users (
                role
            )
        `)
        .eq('key_hash', hashHex)
        .single()

    if (dbError || !keyData) {
        return { context: null, error: 'Invalid API key' }
    }

    if (!keyData.is_active) {
        return { context: null, error: 'API key is inactive. Please contact support.' }
    }

    // 3. User Restrictions (requires_settlement)
    const requiresSettlement = (keyData.users as any)?.requires_settlement || false
    const userRole = (keyData.users as any)?.role || 'user'

    // 4. Rate Limiting (Requests Per Minute)
    const now = new Date()
    const limit = keyData.rate_limit_override || 60 // Default 60 RPM
    
    let currentCount = (keyData as any).requests_this_minute || 0
    const lastReset = new Date((keyData as any).last_minute_timestamp || now)
    
    // Check if a minute has passed since the last reset
    const secondsPassed = (now.getTime() - lastReset.getTime()) / 1000
    
    if (secondsPassed >= 60) {
        // Reset the counter
        currentCount = 1
        await supabase
            .from('api_keys')
            .update({ 
                requests_this_minute: 1, 
                last_minute_timestamp: now.toISOString(),
                last_used_at: now.toISOString() 
            })
            .eq('id', keyData.id)
    } else if (currentCount >= limit) {
        // Limit reached
        return { 
            context: null, 
            error: `Rate limit exceeded. Your limit is ${limit} requests per minute. Try again in ${Math.ceil(60 - secondsPassed)} seconds.` 
        }
    } else {
        // Increment the counter
        currentCount += 1
        await supabase
            .from('api_keys')
            .update({ 
                requests_this_minute: currentCount,
                last_used_at: now.toISOString()
            })
            .eq('id', keyData.id)
    }

    return {
        context: {
            userId: keyData.user_id,
            role: userRole,
            apiKeyId: keyData.id,
            rateLimit: limit,
            requiresSettlement
        },
        error: null
    }
}

/**
 * Utility to generate a new API key.
 * Format: easy_live_<secure_random_string>
 */
export function generateKey(): string {
    const randomChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let result = 'easy_live_'
    const randomValues = new Uint8Array(32)
    crypto.getRandomValues(randomValues)
    for (let i = 0; i < 32; i++) {
        result += randomChars.charAt(randomValues[i] % randomChars.length)
    }
    return result
}

/**
 * Utility to hash an API key for storage.
 */
export async function hashKey(key: string): Promise<string> {
    const hashAsBuffer = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(key)
    )
    return Array.from(new Uint8Array(hashAsBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
}
