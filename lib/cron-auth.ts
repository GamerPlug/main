import crypto from 'crypto'

/**
 * Constant-time verification of the cron bearer secret.
 *
 * Returns true only when the request's Authorization header exactly equals
 * `Bearer <CRON_SECRET>`. Uses crypto.timingSafeEqual so the comparison does
 * not leak the secret via response timing.
 */
export function verifyCronSecret(request: Request): boolean {
    const secret = process.env.CRON_SECRET
    if (!secret) return false

    const expected = `Bearer ${secret}`
    const provided = request.headers.get('authorization') || ''

    const a = Buffer.from(expected)
    const b = Buffer.from(provided)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}
