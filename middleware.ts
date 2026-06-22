import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Helper to add cache-prevention headers
function addNoCacheHeaders(response: NextResponse) {
    response.headers.set('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
}

// Build a per-request Content-Security-Policy.
// - script-src uses a nonce (no 'unsafe-inline'); 'unsafe-eval' only in dev (Next HMR).
// - style-src keeps 'unsafe-inline' (removing it breaks Next/font + many UI libs;
//   style injection is a far lower XSS risk than script injection).
function buildCsp(nonce: string) {
    const isProd = process.env.NODE_ENV === 'production'
    return [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}'${isProd ? '' : " 'unsafe-eval'"} https://js.paystack.co`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https://*.supabase.co https://cdn.jsdelivr.net blob:",
        "connect-src 'self' https://*.supabase.co https://api.paystack.co wss://*.supabase.co",
        "frame-src https://js.paystack.co",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "object-src 'none'",
    ].join('; ')
}

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // Per-request nonce + CSP applied to every (HTML) route this middleware matches.
    // Setting the CSP on the *request* headers lets Next.js stamp the nonce onto the
    // framework's own inline scripts automatically. btoa keeps this Edge-runtime safe.
    const nonce = btoa(crypto.randomUUID())
    const csp = buildCsp(nonce)

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-nonce', nonce)
    requestHeaders.set('content-security-policy', csp)

    const res = NextResponse.next({ request: { headers: requestHeaders } })
    res.headers.set('Content-Security-Policy', csp)

    const isDashboard = pathname.startsWith('/dashboard')
    const isAdmin = pathname.startsWith('/admin')
    const isAuthPage = pathname.startsWith('/auth')

    // Only spend an auth round-trip on routes that actually gate on it.
    if (!isDashboard && !isAdmin && !isAuthPage) {
        return res
    }

    const supabase = createMiddlewareClient({ req: request, res })

    let user = null
    try {
        // getUser() verifies the JWT with the Supabase Auth server (unlike
        // getSession(), which only decodes the cookie). 10s timeout guards hangs.
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Auth timeout')), 10000)
        )
        const { data } = await Promise.race([supabase.auth.getUser(), timeout]) as any
        user = data?.user || null
    } catch (error) {
        console.error('Middleware auth error:', error)
        user = null
    }

    // Protected dashboard routes
    if (isDashboard && !user) {
        return addNoCacheHeaders(NextResponse.redirect(new URL('/auth/login', request.url)))
    }

    // Protected admin routes
    if (isAdmin) {
        if (!user) {
            return addNoCacheHeaders(NextResponse.redirect(new URL('/auth/login', request.url)))
        }

        try {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Role check timeout')), 5000)
            )
            const roleQuery = supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single()

            const { data: profile, error } = await Promise.race([roleQuery, timeout]) as any

            if (error || !profile || (profile.role !== 'admin' && profile.role !== 'sub-admin')) {
                if (error) console.error('Middleware role check failed:', error)
                return addNoCacheHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
            }
        } catch (error) {
            console.error('Middleware role check error:', error)
            return addNoCacheHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
        }
    }

    // Redirect authenticated users away from auth pages
    if (isAuthPage && user) {
        return addNoCacheHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
    }

    return addNoCacheHeaders(res)
}

export const config = {
    // Run on every page route (for CSP/nonce) but skip API routes, Next internals,
    // and any path with a file extension (static assets).
    matcher: ['/((?!api/|_next/|favicon.ico|.*\\.[\\w]+$).*)'],
}
