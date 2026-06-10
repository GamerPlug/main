import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// Lazily initialised so missing env vars throw at call-time, not module load
let _redis: Redis | null = null
let _paymentRatelimit: Ratelimit | null = null

function getRedis(): Redis {
    if (!_redis) {
        if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
            throw new Error('Upstash Redis env vars are not set (KV_REST_API_URL, KV_REST_API_TOKEN)')
        }
        _redis = new Redis({
            url: process.env.KV_REST_API_URL,
            token: process.env.KV_REST_API_TOKEN,
        })
    }
    return _redis
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
