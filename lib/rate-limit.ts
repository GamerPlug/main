import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let _redis: Redis | null = null
let _paymentRatelimit: Ratelimit | null = null
let _bulkOrderRatelimit: Ratelimit | null = null
let _welcomeEmailRatelimit: Ratelimit | null = null
let _pushSubscribeRatelimit: Ratelimit | null = null

export function getRedis(): Redis {
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
    _bulkOrderRatelimit = null
    _welcomeEmailRatelimit = null
    _pushSubscribeRatelimit = null
}

// 20 push subscribe/unsubscribe calls per user per minute (SW re-registration churn)
export function getPushSubscribeRatelimit(): Ratelimit {
    if (!_pushSubscribeRatelimit) {
        _pushSubscribeRatelimit = new Ratelimit({
            redis: getRedis(),
            limiter: Ratelimit.slidingWindow(20, '1 m'),
            prefix: 'gamerplug:push:subscribe',
        })
    }
    return _pushSubscribeRatelimit
}

// 3 welcome-email/SMS sends per IP per 10 minutes (this endpoint is
// unauthenticated by necessity — it fires right after signup)
export function getWelcomeEmailRatelimit(): Ratelimit {
    if (!_welcomeEmailRatelimit) {
        _welcomeEmailRatelimit = new Ratelimit({
            redis: getRedis(),
            limiter: Ratelimit.slidingWindow(3, '10 m'),
            prefix: 'gamerplug:welcome',
        })
    }
    return _welcomeEmailRatelimit
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

// 5 bulk-order requests per API key per minute (each request can contain up to 100 orders)
export function getBulkOrderRatelimit(): Ratelimit {
    if (!_bulkOrderRatelimit) {
        _bulkOrderRatelimit = new Ratelimit({
            redis: getRedis(),
            limiter: Ratelimit.slidingWindow(5, '1 m'),
            prefix: 'gamerplug:api:bulk',
        })
    }
    return _bulkOrderRatelimit
}
