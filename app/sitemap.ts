import type { MetadataRoute } from 'next'

const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://gamerpluggh.com').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
    // Only public, indexable routes. Dashboard/admin/auth are gated and intentionally excluded.
    return [
        {
            url: baseUrl,
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
    ]
}
