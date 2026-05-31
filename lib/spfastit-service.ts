// SPFastIT API service for AT-iShare auto-fulfillment
// API docs: POST https://console.spfastit.com/api/send.php
// Params: api_key, phone (0XXXXXXXXX or 233XXXXXXXXX), bundle_mb (integer, min 50)
// NOTE: 1GB = 1000MB, 2GB = 2000MB, etc.

const SPFASTIT_API_URL = 'https://console.spfastit.com/api/send.php'
const SPFASTIT_API_KEY = process.env.SPFASTIT_API_KEY || ''

interface SPFastITResponse {
    status: 'success' | 'error'
    message: string
}

export interface IShareFulfillResult {
    success: boolean
    message: string
}

// Convert size string to MB integer
// "1GB" → 1000, "2GB" → 2000, "500MB" → 500, "1.5GB" → 1500
// "2GB+1GB" (bonus bundles) → uses first match only
export function parseBundleMB(size: string): number {
    const upper = size.toUpperCase().trim()

    const gbMatch = upper.match(/(\d+(?:\.\d+)?)\s*GB/)
    if (gbMatch) {
        return Math.round(parseFloat(gbMatch[1]) * 1000)
    }

    const mbMatch = upper.match(/(\d+(?:\.\d+)?)\s*MB/)
    if (mbMatch) {
        return Math.round(parseFloat(mbMatch[1]))
    }

    return 0
}

// Normalize phone to 233XXXXXXXXX format
// Accepts: 0XXXXXXXXX, 233XXXXXXXXX, XXXXXXXXX (9 digits)
export function normalizePhone(phone: string): string {
    const cleaned = phone.replace(/[\s\-().+]/g, '')

    if (cleaned.startsWith('233') && cleaned.length === 12) return cleaned
    if (cleaned.startsWith('0') && cleaned.length === 10) return '233' + cleaned.slice(1)
    if (cleaned.length === 9) return '233' + cleaned

    return cleaned
}

export async function fulfillIShareOrder(
    phone: string,
    bundleMB: number
): Promise<IShareFulfillResult> {
    if (!SPFASTIT_API_KEY) {
        return { success: false, message: 'SPFASTIT_API_KEY is not configured' }
    }

    if (bundleMB < 50) {
        return { success: false, message: `Bundle size ${bundleMB}MB is below the 50MB minimum` }
    }

    const normalizedPhone = normalizePhone(phone)

    const body = new URLSearchParams()
    body.append('api_key', SPFASTIT_API_KEY)
    body.append('phone', normalizedPhone)
    body.append('bundle_mb', String(bundleMB))

    try {
        const response = await fetch(SPFASTIT_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
            signal: AbortSignal.timeout(30000), // 30s max — prevents Vercel function hang
        })

        const data: SPFastITResponse = await response.json()

        return {
            success: data.status === 'success',
            message: data.message || (data.status ? `status: ${data.status}` : JSON.stringify(data)),
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Network error reaching SPFastIT API'
        console.error('[SPFastIT] Request failed:', msg)
        return { success: false, message: msg }
    }
}
