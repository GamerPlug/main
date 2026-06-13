import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export type AdminCheck =
    | { ok: true; userId: string; role: string }
    | { ok: false; status: number; error: string }

/**
 * Server-side admin authorization guard for API routes.
 *
 * Uses supabase.auth.getUser() (which verifies the JWT with the auth server,
 * unlike getSession() which only decodes the cookie), then confirms the
 * caller's role from the database. Returns a discriminated result so callers
 * can early-return the correct status code.
 *
 * Usage:
 *   const auth = await requireAdmin()
 *   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
 */
export async function requireAdmin(): Promise<AdminCheck> {
    const cookieStore = await cookies()
    const supabase = createRouteHandlerClient({
        // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
        cookies: () => cookieStore,
    })

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
        return { ok: false, status: 401, error: 'Unauthorized' }
    }

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    const role = (profile as any)?.role
    if (profileError || (role !== 'admin' && role !== 'sub-admin')) {
        return { ok: false, status: 403, error: 'Forbidden - Admin access required' }
    }

    return { ok: true, userId: user.id, role }
}
