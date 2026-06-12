'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { NetworkIcon } from '@/components/network-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import {
    Phone,
    ShoppingCart,
    Loader2,
    MessageSquare,
    Package,
    TrendingUp,
    Database,
    Hash,
    Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Order, Complaint } from '@/types/supabase'
import { format, differenceInHours } from 'date-fns'

interface OrderWithComplaints extends Order {
    complaints?: Complaint[]
}

const NETWORKS = ['All', 'MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const STATUSES = ['All', 'pending', 'processing', 'completed', 'failed']

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
    completed: { label: 'Completed', className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
    processing: { label: 'Processing', className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
    pending: { label: 'Pending', className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
}

export default function MyOrdersPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()
    const [orders, setOrders] = useState<OrderWithComplaints[]>([])

    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [networkFilter, setNetworkFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')
    const [timePeriod, setTimePeriod] = useState('Today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false)

    const [complaintOrder, setComplaintOrder] = useState<Order | null>(null)
    const [complaintDescription, setComplaintDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) fetchData()
            else setIsLoading(false)
        }
    }, [dbUser, isAuthLoading])

    useEffect(() => {
        if (!dbUser) return
        const channel = supabase
            .channel(`my-orders-${dbUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchData()
            })
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [dbUser])

    const fetchData = async () => {
        try {
            const thirtyDaysAgo = new Date()
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
            const { data, error } = await supabase
                .from('orders')
                .select('*, complaints(*)')
                .eq('user_id', dbUser?.id as any)
                .gte('created_at', thirtyDaysAgo.toISOString())
                .order('created_at', { ascending: false })
            if (error) throw error
            setOrders(data || [])
        } catch {
            toast.error('Failed to load orders')
        } finally {
            setIsLoading(false)
        }
    }

    const isWithin48Hours = (createdAt: string) =>
        differenceInHours(new Date(), new Date(createdAt)) < 48

    const filteredOrders = useMemo(() => {
        let filtered = orders
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)
        const weekStart = new Date(today)
        weekStart.setDate(weekStart.getDate() - weekStart.getDay())
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

        filtered = filtered.filter(order => {
            const orderDate = new Date(order.created_at)
            switch (timePeriod) {
                case 'Today': return orderDate >= today
                case 'Yesterday': return orderDate >= yesterday && orderDate < today
                case 'This Week': return orderDate >= weekStart
                case 'This Month': return orderDate >= monthStart
                case 'Custom':
                    if (!customStart || !customEnd) return true
                    const start = new Date(customStart)
                    const end = new Date(customEnd)
                    end.setHours(23, 59, 59, 999)
                    return orderDate >= start && orderDate <= end
                default: return true
            }
        })

        if (networkFilter !== 'All') filtered = filtered.filter(o => o.network === networkFilter)
        if (statusFilter !== 'All') filtered = filtered.filter(o => o.status === statusFilter)
        if (searchQuery) filtered = filtered.filter(o => o.phone_number.includes(searchQuery.toLowerCase()))

        return filtered
    }, [orders, searchQuery, networkFilter, statusFilter, timePeriod, customStart, customEnd])

    const stats = useMemo(() => {
        const countableOrders = filteredOrders.filter(o => o.payment_status == null || o.payment_status !== 'refunded')
        const totalAmount = countableOrders.reduce((sum, o) => sum + (o.price || 0), 0)
        let totalDataGB = 0
        countableOrders.forEach(order => {
            const match = order.size?.toLowerCase().match(/([\d.]+)\s*(gb|mb)/i)
            if (match) {
                const value = parseFloat(match[1])
                totalDataGB += match[2].toLowerCase() === 'gb' ? value : value / 1024
            }
        })
        return {
            totalOrders: filteredOrders.length,
            totalAmount,
            totalData: totalDataGB >= 1 ? totalDataGB.toFixed(0) : totalDataGB.toFixed(2),
        }
    }, [filteredOrders])

    const handleComplaint = (order: Order) => {
        setComplaintOrder(order)
        setComplaintDescription('')
    }

    const submitComplaint = async () => {
        if (!complaintOrder || !complaintDescription) return
        setIsSubmitting(true)
        try {
            const response = await fetch('/api/complaints/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    order_id: complaintOrder.id,
                    title: `Issue with order ${complaintOrder.reference_code}`,
                    description: complaintDescription,
                    priority: 'medium',
                }),
            })
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to submit complaint')
            }
            toast.success('Complaint submitted successfully')
            setOrders(prev => prev.map(o => o.id === complaintOrder.id ? {
                ...o,
                complaints: [{
                    id: 'temp-' + Date.now(),
                    order_id: complaintOrder.id,
                    status: 'pending' as const,
                    title: `Issue with order ${complaintOrder.reference_code}`,
                    description: complaintDescription,
                    created_at: new Date().toISOString(),
                    user_id: dbUser?.id,
                    updated_at: new Date().toISOString(),
                } as any],
            } : o))
            setComplaintOrder(null)
        } catch {
            toast.error('Failed to submit complaint')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-48" />
                <div className="grid grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
                <div className="space-y-3">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-8">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">My Orders</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Track and manage your data bundle orders</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/data-packages">
                        <Button size="sm" className="h-9 px-4 font-semibold gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                            <Plus className="w-4 h-4" />
                            New Order
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-medium text-muted-foreground">Total Orders</p>
                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center">
                            <Package className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">{stats.totalOrders}</p>
                    <p className="text-xs text-muted-foreground mt-1">in period</p>
                </div>

                <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-medium text-muted-foreground">Amount Spent</p>
                        <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                        </div>
                    </div>
                    <p className="text-xl font-bold text-foreground tracking-tight">
                        <span className="text-xs font-semibold text-muted-foreground mr-0.5">GHS</span>
                        {stats.totalAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">excluding refunds</p>
                </div>

                <div className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                        <p className="text-xs font-medium text-muted-foreground">Data Bought</p>
                        <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                            <Database className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                        {stats.totalData}
                        <span className="text-sm font-semibold text-muted-foreground ml-1">GB</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">total delivered</p>
                </div>
            </div>

            {/* Time Period Tabs */}
            <div className="bg-white dark:bg-card border border-border rounded-xl p-1 flex gap-1 shadow-sm">
                {['Today', 'Yesterday', 'This Week', 'This Month'].map(period => (
                    <button
                        key={period}
                        onClick={() => setTimePeriod(period)}
                        className={cn(
                            'flex-1 px-2 py-2 text-xs font-semibold rounded-lg transition-all',
                            timePeriod === period
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        )}
                    >
                        {period}
                    </button>
                ))}
                <button
                    onClick={() => setIsCustomDialogOpen(true)}
                    className={cn(
                        'flex-1 px-2 py-2 text-xs font-semibold rounded-lg transition-all',
                        timePeriod === 'Custom'
                            ? 'bg-primary text-primary-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                    )}
                >
                    {timePeriod === 'Custom' && customStart && customEnd
                        ? `${new Date(customStart).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(customEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                        : 'Custom'}
                </button>
            </div>

            {/* Filters */}
            <div id="order-filters" className="space-y-3">
                <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by phone number"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 rounded-xl bg-background border-border"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10 rounded-xl bg-background border-border font-medium">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            {STATUSES.map(status => (
                                <SelectItem key={status} value={status}>
                                    {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={networkFilter} onValueChange={setNetworkFilter}>
                        <SelectTrigger className="h-10 rounded-xl bg-background border-border font-medium">
                            <SelectValue placeholder="All Networks" />
                        </SelectTrigger>
                        <SelectContent>
                            {NETWORKS.map(network => (
                                <SelectItem key={network} value={network}>
                                    {network === 'All' ? 'All Networks' : network}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Order List */}
            <div id="orders-table" className="space-y-3">
                {filteredOrders.length === 0 ? (
                    <div className="bg-white dark:bg-card border border-border rounded-2xl py-16 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                            <ShoppingCart className="w-7 h-7 text-muted-foreground" />
                        </div>
                        <p className="text-sm font-semibold text-foreground mb-1">No orders found</p>
                        <p className="text-xs text-muted-foreground mb-4">Try adjusting your filters or date range.</p>
                        <Link href="/dashboard/data-packages">
                            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                                Place an order
                            </Button>
                        </Link>
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const statusCfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
                        const hasComplaint = order.complaints && order.complaints.length > 0
                        const canComplain = order.status === 'completed' && isWithin48Hours(order.created_at) && !hasComplaint

                        return (
                            <div
                                key={order.id}
                                className="bg-white dark:bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center justify-between gap-4">
                                    {/* Left: Network icon + details */}
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                                            <NetworkIcon network={order.network} size={28} />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-foreground text-sm">{order.network}</p>
                                                <span className="text-sm font-bold text-foreground">{order.size}</span>
                                                <span className={cn(
                                                    'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border',
                                                    statusCfg.className
                                                )}>
                                                    {statusCfg.label}
                                                </span>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{order.phone_number}</p>
                                        </div>
                                    </div>

                                    {/* Right: price + actions */}
                                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                        <p className="font-bold text-foreground text-sm">{formatCurrency(order.price)}</p>
                                        <p className="text-[11px] text-muted-foreground">
                                            {format(new Date(order.created_at), 'MMM d, HH:mm')}
                                        </p>
                                    </div>
                                </div>

                                {/* Footer row: reference code + action */}
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                        <Hash className="w-3 h-3" />
                                        <span className="font-mono">{order.reference_code || order.id.slice(0, 8)}</span>
                                    </div>

                                    {hasComplaint ? (
                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-muted/50 border-border text-muted-foreground">
                                            <MessageSquare className="w-3 h-3" />
                                            {order.complaints![0].status.replaceAll('_', ' ')}
                                        </div>
                                    ) : canComplain ? (
                                        <Button
                                            id="complaint-button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleComplaint(order)}
                                            className="h-7 px-3 text-[10px] font-semibold uppercase tracking-wide border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-full transition-colors"
                                        >
                                            <MessageSquare className="w-3 h-3 mr-1" />
                                            Report Issue
                                        </Button>
                                    ) : null}
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Complaint Dialog */}
            <Dialog open={!!complaintOrder} onOpenChange={() => setComplaintOrder(null)}>
                <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Report an Issue</DialogTitle>
                        <DialogDescription>
                            Describe the problem with your order. Our team will review within 24 hours.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="rounded-xl bg-muted/50 border border-border p-4 text-sm space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Phone</span>
                                <span className="font-medium text-foreground">{complaintOrder?.phone_number}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Package</span>
                                <span className="font-medium text-foreground">{complaintOrder?.network} · {complaintOrder?.size}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount</span>
                                <span className="font-medium text-foreground">{formatCurrency(complaintOrder?.price || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Reference</span>
                                <span className="font-mono text-xs text-foreground">{complaintOrder?.reference_code}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="complaint-desc">Description</Label>
                            <Textarea
                                id="complaint-desc"
                                placeholder="Describe your issue in detail..."
                                value={complaintDescription}
                                onChange={(e) => setComplaintDescription(e.target.value)}
                                rows={4}
                                className="rounded-xl resize-none"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setComplaintOrder(null)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={submitComplaint}
                            disabled={isSubmitting || !complaintDescription.trim()}
                            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : 'Submit Report'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Date Range Dialog */}
            <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
                <DialogContent className="sm:max-w-sm rounded-2xl">
                    <DialogHeader>
                        <DialogTitle>Custom Date Range</DialogTitle>
                        <DialogDescription>Filter your orders by a specific date range.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-2">
                        <div className="grid gap-2">
                            <Label htmlFor="u-start">Start Date</Label>
                            <Input
                                id="u-start"
                                type="date"
                                value={customStart}
                                onChange={(e) => setCustomStart(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="u-end">End Date</Label>
                            <Input
                                id="u-end"
                                type="date"
                                value={customEnd}
                                onChange={(e) => setCustomEnd(e.target.value)}
                                className="rounded-xl"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)} className="rounded-xl">
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (customStart && customEnd) {
                                    setTimePeriod('Custom')
                                    setIsCustomDialogOpen(false)
                                } else {
                                    toast.error('Please select both start and end dates')
                                }
                            }}
                            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                            Apply
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
