import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'
import { resolvePackagePrice, getUserPriceOverrides } from '@/lib/pricing'

export async function GET(request: NextRequest) {
    // 1. Authenticate API Key
    const { context, error } = await validateApiKey(request)
    if (error || !context) {
        return NextResponse.json({ error: error || 'Unauthorized' }, { status: 401 })
    }

    if (context.requiresSettlement) {
        return NextResponse.json({ 
            error: 'Account settlement required. Please contact admin to activate your API access.' 
        }, { status: 403 })
    }

    const { role, userId } = context

    // 2. Fetch Packages
    const supabase = createServerClient()
    const { data: packages, error: pkgError } = await supabase
        .from('data_packages')
        .select('*')
        .eq('is_available', true)
        .order('network', { ascending: true })
        .order('id', { ascending: true })

    if (pkgError || !packages) {
        return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 })
    }

    // 3. Map Packages with prices (per-user override > role > base)
    const priceOverrides = await getUserPriceOverrides(supabase, userId)
    const filteredPackages = packages.map((pkg: any) => {
        const price = resolvePackagePrice(pkg, role, priceOverrides)

        return {
            id: pkg.id,
            network: pkg.network,
            size: pkg.size,
            bundle_name: pkg.size,
            price: parseFloat(price.toString()),
            currency: 'GHS',
            is_available: pkg.is_available,
            description: pkg.description || ''
        }
    })

    return NextResponse.json({
        packages: filteredPackages,
        user_role: role
    })
}
