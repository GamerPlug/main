import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createServerClient } from '@/lib/supabase'

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

    const { role } = context

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

    // 3. Map Packages with prices based on role
    const filteredPackages = packages.map((pkg: any) => {
        let price = pkg.price
        
        switch (role) {
            case 'platinum':
                price = pkg.platinum_price || pkg.price
                break
            case 'super dealer':
                price = pkg.super_dealer_price || pkg.price
                break
            case 'dealer':
                price = pkg.dealer_price || pkg.price
                break
            case 'super agent':
                price = pkg.super_agent_price || pkg.price
                break
            case 'agent':
                price = pkg.agent_price || pkg.price
                break
            default:
                price = pkg.price
        }

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
