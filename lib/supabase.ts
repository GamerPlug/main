import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Standard browser client that syncs with cookies.
// Force every REST/auth request to bypass the browser HTTP cache. Cross-origin
// Supabase GETs (e.g. the user row that carries `role`) aren't covered by our
// app-level no-store headers, and some Android browsers/WebViews cache them
// aggressively — which made stale data like an old user role survive a hard
// refresh. `cache: 'no-store'` guarantees the role is always read fresh.
export const supabase = createClientComponentClient<Database>({
    options: {
        global: {
            fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
        },
    },
})

// Server client with service role for admin operations (bypasses RLS)
export const createServerClient = () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    return createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
