import type { NextConfig } from 'next'

// Note: Content-Security-Policy is set per-request in middleware.ts (it needs a
// per-request nonce for script-src). These static headers apply to every route.
const securityHeaders = [
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-XSS-Protection', value: '1; mode=block' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
]

const nextConfig: NextConfig = {
    reactStrictMode: true,
    poweredByHeader: false,
    compiler: {
        removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
    },
    images: {
        formats: ['image/avif', 'image/webp'],
        domains: ['localhost'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
        ],
        minimumCacheTTL: 60,
    },
    async headers() {
        return [
            // Long-lived immutable cache for content-hashed static assets
            {
                source: '/_next/static/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                    ...securityHeaders,
                ],
            },
            // Images can be cached for a day
            {
                source: '/_next/image:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
                    ...securityHeaders,
                ],
            },
            // Public static files (icons, fonts, etc.)
            {
                source: '/fonts/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            // All other routes: no-store to keep data fresh (auth + real-time app)
            {
                source: '/((?!_next/static|_next/image|fonts).*)',
                headers: [
                    { key: 'Cache-Control', value: 'no-store, no-cache, max-age=0, must-revalidate' },
                    { key: 'Pragma', value: 'no-cache' },
                    { key: 'Expires', value: '0' },
                    ...securityHeaders,
                ],
            },
        ]
    },
}

export default nextConfig
