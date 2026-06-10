import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null
let _paymentRatelimit: Ratelimit | null = null

function getRedis(): Redis {
    if (!_redis) {
        if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
            throw new Error('Upstash env vars not set (KV_REST_API_URL, KV_REST_API_TOKEN)')
        }
        _redis = new Redis({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN,
        })
    }
    return _redis
}

// Reset singletons so the next call gets a fresh connection after a failure
export function resetRatelimitSingletons() {
    _redis = null
    _paymentRatelimit = null
}

// 10 payment init attempts per user per minute
export function getPaymentRatelimit(): Ratelimit {
    if (!_paymentRatelimit) {
        _paymentRatelimit = new Ratelimit({
            redis: getRedis(),
            limiter: Ratelimit.slidingWindow(10, '1 m'),
            prefix: 'gamerplug:payment:init',
        })
    }
    return _paymentRatelimit
}
