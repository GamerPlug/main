import type { MetadataRoute } from 'next'

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://gamerpluggh.com').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            // Private / authenticated areas — keep out of search results
            disallow: ['/dashboard/', '/admin/', '/api/', '/auth/', '/offline'],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    }
}
