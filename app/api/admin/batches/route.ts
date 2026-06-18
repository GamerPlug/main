import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { requireAdmin } from '@/lib/admin-auth'

export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin()
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status })
        }

        const { searchParams } = new URL(request.url)
        const limit = parseInt(searchParams.get('limit') || '50')
        const offset = parseInt(searchParams.get('offset') || '0')
        const network = searchParams.get('network')
        const startDate = searchParams.get('startDate') // ISO string
        const endDate = searchParams.get('endDate') // ISO string
        // Strip characters that could escape the PostgREST .or() filter syntax
        const search = searchParams.get('search')?.replace(/[%_,()]/g, '').substring(0, 100) || null

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Deep Search: If search term provided, find batches containing matching orders
        let batchIdsFromSearch: string[] = []
        if (search) {
            const { data: matchingOrders } = await supabase
                .from('orders')
                .select('download_batch_id')
                .or(`phone_number.ilike.%${search}%,reference_code.ilike.%${search}%`)
                .not('download_batch_id', 'is', null)
                .limit(100)

            if (matchingOrders && matchingOrders.length > 0) {
                batchIdsFromSearch = [...new Set(matchingOrders.map((o: any) => o.download_batch_id))]
            } else {
                // If search yields no orders, return empty result immediately
                return NextResponse.json({ batches: [], totalCount: 0 })
            }
        }

        let query = supabase
            .from('download_batches')
            .select('*', { count: 'exact' })
            .gt('order_count', 0)

        if (batchIdsFromSearch.length > 0) {
            query = query.in('id', batchIdsFromSearch)
        }

        if (network && network !== 'all') {
            query = query.eq('network', network)
        }

        if (startDate) {
            query = query.gte('created_at', startDate)
        }
        if (endDate) {
            query = query.lte('created_at', endDate)
        }

        const { data: batches, count, error: fetchError } = await query
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (fetchError) {
            console.error('[AdminBatchesFetch] Error:', fetchError)
            throw fetchError
        }

        // Calculate status summary for each batch
        if (batches && batches.length > 0) {
            const batchIds = batches.map(b => b.id)
            const { data: statusCounts, error: statsError } = await supabase
                .from('orders')
                .select('download_batch_id, status')
                .in('download_batch_id', batchIds)
            
            if (!statsError && statusCounts) {
                const statsMap = statusCounts.reduce((acc: any, curr: any) => {
                    const bid = curr.download_batch_id
                    if (!acc[bid]) acc[bid] = { pending: 0, processing: 0, completed: 0, failed: 0 }
                    acc[bid][curr.status] = (acc[bid][curr.status] || 0) + 1
                    return acc
                }, {})
                
                batches.forEach(b => {
                    b.status_summary = statsMap[b.id] || { pending: 0, processing: 0, completed: 0, failed: 0 }
                })
            }
        }

        return NextResponse.json({
            batches: batches || [],
            totalCount: count || 0
        })
    } catch (error: any) {
        console.error('Admin Batches Fetch Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
