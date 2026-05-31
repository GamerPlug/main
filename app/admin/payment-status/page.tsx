'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, RefreshCw, Zap } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'
import { toast } from 'sonner'

const NETWORKS = ['All', 'MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const STATUSES = ['All', 'pending', 'processing', 'completed', 'failed']
const DATE_FILTERS = ['Today', 'Last 7 days', 'All time']

const PAGE_SIZE = 50

export default function AdminPaymentStatusPage() {
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [fulfilling, setFulfilling] = useState(false)
    const [networkFilter, setNetworkFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')
    const [dateFilter, setDateFilter] = useState('All time')
    const [page, setPage] = useState(0)
    const [hasMore, setHasMore] = useState(false)
    const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null)

    const fetchOrders = useCallback(async (pageNum = 0) => {
        setLoading(true)
        try {
            let query = (supabase
                .from('orders') as any)
                .select(`
                    id,
                    reference_code,
                    phone_number,
                    network,
                    size,
                    price,
                    amount,
                    status,
                    payment_status,
                    created_at,
                    updated_at,
                    user_id,
                    users (first_name, last_name, email)
                `, { count: 'exact' })
                .eq('payment_status', 'paid')
                .order('created_at', { ascending: false })
                .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1)

            if (networkFilter !== 'All') {
                query = query.eq('network', networkFilter)
            }
            if (statusFilter !== 'All') {
                query = query.eq('status', statusFilter)
            }
            if (dateFilter === 'Today') {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                query = query.gte('created_at', today.toISOString())
            } else if (dateFilter === 'Last 7 days') {
                const sevenDaysAgo = new Date()
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
                query = query.gte('created_at', sevenDaysAgo.toISOString())
            }

            const { data, count, error } = await query

            if (error) throw error

            if (pageNum === 0) {
                setOrders(data || [])
            } else {
                setOrders(prev => [...prev, ...(data || [])])
            }

            setHasMore((count || 0) > (pageNum + 1) * PAGE_SIZE)
        } catch (err: any) {
            toast.error('Failed to load orders')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [networkFilter, statusFilter, dateFilter])

    useEffect(() => {
        setPage(0)
        fetchOrders(0)
    }, [fetchOrders])

    // Real-time subscription
    useEffect(() => {
        const channel = (supabase as any)
            .channel('admin-payment-status')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchOrders(0)
                setPage(0)
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchOrders])

    const handleAutoFulfillAll = async () => {
        setFulfilling(true)
        try {
            const res = await fetch('/api/admin/ishare/fulfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Request failed')

            toast.success(
                `Auto-fulfill complete — ${data.fulfilled} fulfilled, ${data.skipped} skipped, ${data.failed} failed`
            )
            fetchOrders(0)
            setPage(0)
        } catch (err: any) {
            toast.error(err.message || 'Auto-fulfill failed')
        } finally {
            setFulfilling(false)
        }
    }

    const handleFulfillSingle = async (orderId: string) => {
        setUpdatingOrderId(orderId)
        try {
            const res = await fetch('/api/admin/ishare/fulfill', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId }),
            })
            const data = await res.json()

            if (!res.ok) throw new Error(data.error || 'Request failed')

            const result = data.results?.[0]
            if (result?.success) {
                toast.success(`Order ${result.ref} fulfilled successfully`)
            } else if (result?.skipped) {
                toast.info(`Order ${result.ref} — ${result.message}`)
            } else {
                toast.error(`Order ${result?.ref} failed: ${result?.message}`)
            }
            fetchOrders(0)
            setPage(0)
        } catch (err: any) {
            toast.error(err.message || 'Fulfillment failed')
        } finally {
            setUpdatingOrderId(null)
        }
    }

    const handleStatusChange = async (orderId: string, newStatus: string) => {
        setUpdatingOrderId(orderId)
        try {
            const res = await fetch('/api/admin/orders/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, status: newStatus }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to update status')

            toast.success(`Order status updated to ${newStatus}`)
            fetchOrders(0)
            setPage(0)
        } catch (err: any) {
            toast.error(err.message || 'Status update failed')
        } finally {
            setUpdatingOrderId(null)
        }
    }

    const statusBadgeVariant = (status: string) => {
        if (status === 'completed') return 'completed' as const
        if (status === 'failed') return 'failed' as const
        if (status === 'processing') return 'secondary' as const
        return 'outline' as const
    }

    const loadMore = () => {
        const next = page + 1
        setPage(next)
        fetchOrders(next)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Order Payment Status</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        All orders with confirmed payment — manage statuses and trigger fulfillment
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleAutoFulfillAll}
                        disabled={fulfilling}
                        className="gap-2"
                    >
                        {fulfilling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Zap className="w-4 h-4" />
                        )}
                        Auto Fulfill Pending iShare Orders
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => { setPage(0); fetchOrders(0) }} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Network</span>
                            <Select value={networkFilter} onValueChange={setNetworkFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {NETWORKS.map(n => (
                                        <SelectItem key={n} value={n}>{n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Status</span>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUSES.map(s => (
                                        <SelectItem key={s} value={s}>{s === 'All' ? 'All statuses' : s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-muted-foreground">Date</span>
                            <Select value={dateFilter} onValueChange={setDateFilter}>
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DATE_FILTERS.map(d => (
                                        <SelectItem key={d} value={d}>{d}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Orders Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Paid Orders</CardTitle>
                    <CardDescription>
                        Showing {orders.length} order{orders.length !== 1 ? 's' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading && orders.length === 0 ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : orders.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12 text-sm">
                            No paid orders found with the selected filters.
                        </p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Created</TableHead>
                                            <TableHead>Ref</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Network</TableHead>
                                            <TableHead>Size</TableHead>
                                            <TableHead>Amount</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {orders.map((order) => {
                                            const isUpdating = updatingOrderId === order.id
                                            const isISharePending = order.network === 'AT-iShare' && order.status === 'pending'

                                            return (
                                                <TableRow key={order.id}>
                                                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                        {formatDate(order.created_at)}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">
                                                        {order.reference_code}
                                                    </TableCell>
                                                    <TableCell className="text-sm">
                                                        {order.phone_number}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className="text-xs">
                                                            {order.network}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {order.size}
                                                    </TableCell>
                                                    <TableCell className="text-sm font-medium">
                                                        {formatCurrency(order.price || order.amount || 0)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={statusBadgeVariant(order.status)}>
                                                            {order.status}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {/* Status change dropdown */}
                                                            <Select
                                                                value={order.status}
                                                                onValueChange={(val) => handleStatusChange(order.id, val)}
                                                                disabled={isUpdating}
                                                            >
                                                                <SelectTrigger className="w-32 h-7 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="pending">pending</SelectItem>
                                                                    <SelectItem value="processing">processing</SelectItem>
                                                                    <SelectItem value="completed">completed</SelectItem>
                                                                    <SelectItem value="failed">failed</SelectItem>
                                                                </SelectContent>
                                                            </Select>

                                                            {/* Fulfill button for pending iShare orders */}
                                                            {isISharePending && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-7 px-2 text-xs gap-1"
                                                                    onClick={() => handleFulfillSingle(order.id)}
                                                                    disabled={isUpdating}
                                                                >
                                                                    {isUpdating ? (
                                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                                    ) : (
                                                                        <Zap className="w-3 h-3" />
                                                                    )}
                                                                    Fulfill
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {hasMore && (
                                <div className="flex justify-center py-4 border-t">
                                    <Button variant="outline" onClick={loadMore} disabled={loading}>
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Load more
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
