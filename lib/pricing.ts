/**
 * Centralized package price resolution.
 *
 * Resolution priority (highest first):
 *   1. Per-user custom override (user_package_pricing) — set by admin
 *   2. Role price (dealer_price / agent_price) when > 0
 *   3. Base price (admin price)
 *
 * The custom override applies regardless of role. This is the single
 * source of truth — every order/pricing path must use it so behaviour
 * never drifts between the web app, bulk, and the public v1 API.
 *
 * IMPORTANT: price is always resolved server-side from the DB before a
 * wallet deduction. Any client-side price is display-only.
 */

interface PricedPackage {
    id: string
    price: number
    dealer_price?: number | null
    agent_price?: number | null
}

/**
 * Pure resolver. `overrides` maps packageId -> custom_price.
 */
export function resolvePackagePrice(
    pkg: PricedPackage,
    role: string | null | undefined,
    overrides?: Map<string, number> | null
): number {
    // A valid override must be positive — the wallet RPC rejects amounts <= 0,
    // so a 0/negative override would make checkout impossible. Fall back instead.
    const override = overrides?.get(pkg.id)
    if (override != null && override > 0) {
        return override
    }

    if (role === 'dealer' && (pkg.dealer_price ?? 0) > 0) {
        return pkg.dealer_price as number
    }
    if (role === 'agent' && (pkg.agent_price ?? 0) > 0) {
        return pkg.agent_price as number
    }
    return pkg.price
}

/**
 * Fetch a user's custom price overrides as a Map<packageId, custom_price>.
 * Pass `packageIds` to limit the lookup (bulk orders); omit to fetch all.
 * Uses whichever supabase client is passed (server routes pass service-role).
 * Never throws — returns an empty map on error so pricing falls back safely.
 */
export async function getUserPriceOverrides(
    supabase: any,
    userId: string,
    packageIds?: string[]
): Promise<Map<string, number>> {
    const map = new Map<string, number>()
    if (!userId) return map

    try {
        let query = supabase
            .from('user_package_pricing')
            .select('package_id, custom_price')
            .eq('user_id', userId)

        if (packageIds && packageIds.length > 0) {
            query = query.in('package_id', [...new Set(packageIds)])
        }

        const { data, error } = await query
        if (error || !data) return map

        for (const row of data as { package_id: string; custom_price: number }[]) {
            map.set(row.package_id, Number(row.custom_price))
        }
    } catch {
        // fall back to role/base pricing on any failure
    }

    return map
}
