import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export type AuthCheck =
    | { ok: true; userId: string; role: string; email: string | null }
    | { ok: false; status: number; error: string }

// Kept as an alias for older call sites that imported AdminCheck.
export type AdminCheck = AuthCheck

async function getAuthedClient() {
    const cookieStore = await cookies()
    return createRouteHandlerClient({
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore,
    })
}

/**
 * Server-side authentication guard for API routes.
 *
 * Uses supabase.auth.getUser() (which verifies the JWT with the Supabase Auth
 * server, unlike getSession() which only decodes the cookie), then loads the
 * caller's role from the database. Returns a discriminated result so callers
 * can early-return the correct status code.
 *
 * Usage:
 *   const auth = await requireUser()
 *   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
 *   // auth.userId, auth.role are now trusted
 */
export async function requireUser(): Promise<AuthCheck> {
    const supabase = await getAuthedClient()

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { ok: false, status: 401, error: 'Unauthorized' }
    }

    const { data: profile } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    return { ok: true, userId: user.id, role: (profile as any)?.role ?? 'user', email: user.email ?? null }
}

/**
 * Server-side admin authorization guard for API routes.
 * Same verification as requireUser(), then requires an admin/sub-admin role.
 */
export async function requireAdmin(): Promise<AuthCheck> {
    const auth = await requireUser()
    if (!auth.ok) return auth

    if (auth.role !== 'admin' && auth.role !== 'sub-admin') {
        return { ok: false, status: 403, error: 'Forbidden - Admin access required' }
    }
    return auth
}
