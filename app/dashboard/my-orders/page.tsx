'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { NetworkIcon } from '@/components/network-icon'
import { Card, CardContent } from '@/components/ui/card'
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
import {
    Phone,
    ShoppingCart,
    Loader2,
    MessageSquare,
    Wifi
} from 'lucide-react'
import { toast } from 'sonner'
import { Order, DataPackage, Complaint } from '@/types/supabase'
import { format, differenceInHours } from 'date-fns'
import { useTutorial } from '@/hooks/useTutorial'
import { HelpButton } from '@/components/tutorial/HelpButton'

interface OrderWithComplaints extends Order {
    complaints?: Complaint[]
}

const NETWORKS = ['All', 'MTN', 'Telecel', 'AT-iShare', 'AT-BigTime']
const STATUSES = ['All', 'pending', 'processing', 'completed', 'failed']
const TIME_PERIODS = ['Today', 'Yesterday', 'This Week', 'This Month', 'Custom']

export default function MyOrdersPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()
    const [orders, setOrders] = useState<OrderWithComplaints[]>([])

    // Tutorial hook
    const userRole = dbUser?.role === 'agent' ? 'agent' : 'user'
    const { startTutorial } = useTutorial(userRole as 'user' | 'agent', '/orders')
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [networkFilter, setNetworkFilter] = useState('All')
    const [statusFilter, setStatusFilter] = useState('All')
    const [timePeriod, setTimePeriod] = useState('Today')
    const [customStart, setCustomStart] = useState('')
    const [customEnd, setCustomEnd] = useState('')
    const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false)

    // Complaint dialog
    const [complaintOrder, setComplaintOrder] = useState<Order | null>(null)
    const [complaintDescription, setComplaintDescription] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) {
                fetchData()
            } else {
                setIsLoading(false)
            }
        }
    }, [dbUser, isAuthLoading])

    // Real-time subscription for live order updates
    useEffect(() => {
        if (!dbUser) return

        const channel = supabase
            .channel(`my-orders-${dbUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dbUser])

    const fetchData = async () => {
        try {
            // Only fetch orders from the last 30 days for performance
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
        } catch (error) {
            console.error('Error fetching data:', error)
            toast.error('Failed to load orders')
        } finally {
            setIsLoading(false)
        }
    }

    // Check if order is within 48 hours for complaint eligibility
    const isWithin48Hours = (createdAt: string) => {
        const orderDate = new Date(createdAt)
        const now = new Date()
        return differenceInHours(now, orderDate) < 48
    }

    // Get product name based on network for consistent display
    const getProductName = (order: Order) => {
        const networkNames: Record<string, string> = {
            'MTN': 'MTN Data Bundle',
            'Telecel': 'Telecel Data Bundle',
            'AT-iShare': 'AT Premium Bundle',
            'AT-BigTime': 'AT BigTime Bundle',
        }
        return networkNames[order.network] || `${order.network} Bundle`
    }

    // Filter orders based on all criteria
    const filteredOrders = useMemo(() => {
        let filtered = orders

        // Time period filter
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
                case 'Today':
                    return orderDate >= today
                case 'Yesterday':
                    return orderDate >= yesterday && orderDate < today
                case 'This Week':
                    return orderDate >= weekStart
                case 'This Month':
                    return orderDate >= monthStart
                case 'Custom':
                    if (!customStart || !customEnd) return true
                    const start = new Date(customStart)
                    const end = new Date(customEnd)
                    end.setHours(23, 59, 59, 999)
                    return orderDate >= start && orderDate <= end
                default:
                    return true
            }
        })

        // Network filter
        if (networkFilter !== 'All') {
            filtered = filtered.filter(o => o.network === networkFilter)
        }

        // Status filter
        if (statusFilter !== 'All') {
            filtered = filtered.filter(o => o.status === statusFilter)
        }

        // Phone search
        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(o =>
                o.phone_number.includes(query)
            )
        }

        return filtered
    }, [orders, searchQuery, networkFilter, statusFilter, timePeriod])

    // Calculate stats from filtered orders
    const stats = useMemo(() => {
        const paidOrders = filteredOrders.filter(o => o.payment_status !== 'refunded')
        const totalAmount = paidOrders.reduce((sum, o) => sum + (o.price || 0), 0)

        // Parse data sizes and sum them
        let totalDataGB = 0
        paidOrders.forEach(order => {
            const sizeStr = order.size.toLowerCase()
            const match = sizeStr.match(/([\d.]+)\s*(gb|mb)/i)
            if (match) {
                const value = parseFloat(match[1])
                const unit = match[2].toLowerCase()
                if (unit === 'gb') {
                    totalDataGB += value
                } else if (unit === 'mb') {
                    totalDataGB += value / 1024
                }
            }
        })

        return {
            totalOrders: filteredOrders.length,
            totalAmount,
            totalData: totalDataGB.toFixed(totalDataGB >= 1 ? 0 : 2)
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
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to submit complaint')
            }

            const { complaint: newComplaintFromServer } = await response.json() // Get actual data from server if needed

            toast.success('Complaint submitted successfully')
            // Refresh logic - optimistically add complaint to state
            const newComplaint = {
                id: 'temp-' + Date.now(),
                order_id: complaintOrder.id,
                status: 'pending' as const,
                title: `Issue with order ${complaintOrder.reference_code}`,
                description: complaintDescription,
                created_at: new Date().toISOString(),
                user_id: dbUser?.id,
                updated_at: new Date().toISOString()
            }
            setOrders(orders.map(o => o.id === complaintOrder.id ? { ...o, complaints: [newComplaint as any] } : o))
            setComplaintOrder(null)
        } catch (error) {
            toast.error('Failed to submit complaint')
        } finally {
            setIsSubmitting(false)
        }
    }

    const getStatusBadgeClass = (status: string) => {
        switch (status) {
            case 'completed':
                return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
            case 'processing':
                return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
            case 'failed':
                return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            default:
                return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        }
    }

    // const getNetworkIcon = (network: string) => { ... } // Removed

    const formatOrderDate = (dateStr: string) => {
        return format(new Date(dateStr), 'MMM dd, yyyy HH:mm')
    }

    // Format amount for display (no truncation)
    const formatAmount = (amount: number) => {
        return `₵${amount.toFixed(2)}`
    }

    if (isLoading) {
        return (
            <div className="space-y-6 px-4 py-6">
                <div className="text-center space-y-2">
                    <Skeleton className="h-8 w-48 mx-auto" />
                    <Skeleton className="h-4 w-64 mx-auto" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-20" />
                    ))}
                </div>
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 pb-8 relative z-10">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-white tracking-tight">My Orders</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Track and manage your recent transactions</p>
                </div>

                {/* Help Button */}
                <div>
                    <HelpButton onClick={startTutorial} />
                </div>
            </div>

            {/* Summary Stats - Glowing Glass Cards */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 relative z-10">
                <div className="glass-card rounded-2xl p-4 sm:p-5 text-center flex flex-col items-center justify-center relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl bg-white/50 dark:bg-black/40">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 dark:bg-blue-500/20 rounded-full blur-2xl group-hover:bg-blue-500/10 dark:group-hover:bg-blue-500/30 transition-colors"></div>
                    <p className="text-slate-900 dark:text-white text-xl sm:text-2xl font-semibold tracking-tight leading-none mb-1">{stats.totalOrders}</p>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest relative z-10">Total Orders</p>
                </div>

                <div className="glass-card rounded-2xl p-4 sm:p-5 text-center flex flex-col items-center justify-center relative overflow-hidden group border-yellow-500/30 bg-yellow-50 dark:bg-yellow-500/5 shadow-sm dark:shadow-[0_0_20px_rgba(234,179,8,0.15)]">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-yellow-500/5 dark:bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/10 dark:group-hover:bg-yellow-500/20 transition-colors"></div>
                    <p className="text-yellow-600 dark:text-yellow-400 text-xl sm:text-2xl font-semibold tracking-tight leading-none mb-1">
                        {formatAmount(stats.totalAmount)}
                    </p>
                    <p className="text-[10px] sm:text-xs font-medium text-yellow-600/70 dark:text-yellow-500/70 uppercase tracking-widest relative z-10">Total Amount</p>
                </div>

                <div className="glass-card rounded-2xl p-4 sm:p-5 text-center flex flex-col items-center justify-center relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl bg-white/50 dark:bg-black/40">
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-500/5 dark:bg-cyan-500/20 rounded-full blur-2xl group-hover:bg-cyan-500/10 dark:group-hover:bg-cyan-500/30 transition-colors"></div>
                    <p className="text-slate-900 dark:text-white text-xl sm:text-2xl font-semibold tracking-tight leading-none mb-1">{stats.totalData} <span className="text-sm text-slate-500 dark:text-slate-400">GB</span></p>
                    <p className="text-[10px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest relative z-10">Total Data</p>
                </div>
            </div>

            {/* Time Period Filters */}
            <div className="flex flex-wrap items-center gap-2 relative z-10 w-full bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-slate-200 dark:border-white/5 rounded-2xl p-1.5 shadow-sm dark:shadow-xl">
                {['Today', 'Yesterday', 'This Week', 'This Month'].map((period) => (
                    <button
                        key={period}
                        onClick={() => setTimePeriod(period)}
                        className={cn(
                            "flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all duration-300",
                            timePeriod === period
                                ? "bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg scale-[1.02]"
                                : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                        )}
                    >
                        {period}
                    </button>
                ))}
                <button
                    onClick={() => setIsCustomDialogOpen(true)}
                    className={cn(
                        "flex-1 px-2 py-2 text-[10px] sm:text-xs font-bold rounded-xl transition-all duration-300",
                        timePeriod === 'Custom'
                            ? "bg-gradient-to-r from-primary to-cyan-500 text-white shadow-lg scale-[1.02]"
                            : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5"
                    )}
                >
                    {timePeriod === 'Custom' && customStart && customEnd
                        ? `${new Date(customStart).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}-${new Date(customEnd).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}`
                        : 'Custom Range'}
                </button>
            </div>

            {/* Filters */}
            <div id="order-filters" className="space-y-4">
                {/* Search by Phone */}
                <div className="space-y-2 relative z-10">
                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Search by Phone</Label>
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl transition-colors pointer-events-none"></div>
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                        <Input
                            placeholder="Enter phone number"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-11 h-14 bg-white/50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl focus-visible:ring-primary/50 text-base shadow-sm dark:shadow-lg relative z-10"
                        />
                    </div>
                </div>

                {/* Filter Dropdowns */}
                <div className="grid grid-cols-2 gap-4 relative z-10">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full h-12 bg-white/50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:ring-primary/50 font-bold">
                                <SelectValue placeholder="All Statuses" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                                {STATUSES.map((status) => (
                                    <SelectItem key={status} value={status} className="focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white font-bold cursor-pointer">
                                        {status === 'All' ? 'All Statuses' : status.charAt(0).toUpperCase() + status.slice(1)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Network</Label>
                        <Select value={networkFilter} onValueChange={setNetworkFilter}>
                            <SelectTrigger className="w-full h-12 bg-white/50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:ring-primary/50 font-bold">
                                <SelectValue placeholder="All Networks" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                                {NETWORKS.map((network) => (
                                    <SelectItem key={network} value={network} className="focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white font-bold cursor-pointer">
                                        {network === 'All' ? 'All Networks' : network}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* Order Cards */}
            <div id="orders-table" className="space-y-4 mt-6">
                {filteredOrders.length === 0 ? (
                    <div className="glass-card rounded-[2rem] py-16 text-center border-slate-200 dark:border-white/5 flex flex-col items-center justify-center bg-white/50 dark:bg-black/40 shadow-sm dark:shadow-xl">
                        <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-4">
                            <ShoppingCart className="w-10 h-10 text-slate-400 dark:text-slate-500/50" />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 font-bold">No orders found</p>
                    </div>
                ) : (
                    filteredOrders.map((order) => {
                        const statusColors: any = {
                            completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm dark:shadow-[0_0_15px_rgba(16,185,129,0.15)]',
                            processing: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm dark:shadow-[0_0_15px_rgba(6,182,212,0.15)]',
                            failed: 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-sm dark:shadow-[0_0_15px_rgba(225,29,72,0.15)]',
                            pending: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm dark:shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                        }

                        const statusClass = statusColors[order.status] || statusColors.pending;

                        return (
                            <div key={order.id} className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-white/5 hover:border-slate-300 dark:hover:border-white/10 shadow-sm hover:shadow-xl transition-all group z-10 relative bg-white/50 dark:bg-black/40 backdrop-blur-md">
                                <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                                    {/* Left: Icon & Details */}
                                    <div className="flex items-center gap-4">
                                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 shadow-inner">
                                            <NetworkIcon network={order.network} size={40} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-semibold text-slate-900 dark:text-white text-base leading-none">{getProductName(order)}</p>
                                                <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest border", statusClass)}>
                                                    {order.status}
                                                </span>
                                            </div>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">{order.phone_number}</p>
                                        </div>
                                    </div>

                                    {/* Right: Price & Time & Actions */}
                                    <div className="flex flex-col sm:items-end gap-3 sm:gap-1 mt-2 sm:mt-0 border-t border-slate-100 dark:border-white/10 sm:border-0 pt-3 sm:pt-0">
                                        <p className="font-semibold text-base text-slate-900 dark:text-white leading-none text-left sm:text-right">
                                            {formatCurrency(order.price)}
                                        </p>
                                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto mt-1">
                                            <span className="text-[11px] text-slate-500 dark:text-slate-400">{formatOrderDate(order.created_at)}</span>

                                            {/* Action Area */}
                                            {order.complaints && order.complaints.length > 0 ? (
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
                                                    <MessageSquare className="w-3 h-3" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">
                                                        {order.complaints[0].status.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            ) : (
                                                order.status === 'completed' && isWithin48Hours(order.created_at) && (
                                                    <Button
                                                        id="complaint-button"
                                                        size="sm"
                                                        onClick={() => handleComplaint(order)}
                                                        className="h-7 px-3 text-[10px] font-bold uppercase tracking-widest bg-rose-500/20 hover:bg-rose-500 border border-rose-500/50 text-rose-300 hover:text-white transition-all rounded-md"
                                                    >
                                                        <MessageSquare className="w-3 h-3 mr-1" />
                                                        Complain
                                                    </Button>
                                                )
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Complaint Dialog */}
            <Dialog open={!!complaintOrder} onOpenChange={() => setComplaintOrder(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>File a Complaint</DialogTitle>
                        <DialogDescription>
                            Describe the issue with your order
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="p-4 rounded-xl bg-muted/50 text-sm">
                            <div className="flex justify-between">
                                <span>Phone:</span>
                                <span>{complaintOrder?.phone_number}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Package:</span>
                                <span>{complaintOrder?.size}</span>
                            </div>
                            <div className="flex justify-between mt-1">
                                <span>Amount:</span>
                                <span>{formatCurrency(complaintOrder?.price || 0)}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                placeholder="Describe your issue..."
                                value={complaintDescription}
                                onChange={(e) => setComplaintDescription(e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setComplaintOrder(null)}>
                            Cancel
                        </Button>
                        <Button onClick={submitComplaint} disabled={isSubmitting || !complaintDescription}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                'Submit Complaint'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Custom Date Filter Dialog */}
            <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
                <DialogContent className="sm:max-w-sm rounded-[24px]">
                    <DialogHeader>
                        <DialogTitle>Select Date Range</DialogTitle>
                        <DialogDescription>
                            Filter your order history by date.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
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
                        <Button variant="outline" onClick={() => setIsCustomDialogOpen(false)} className="rounded-xl">Cancel</Button>
                        <Button
                            onClick={() => {
                                if (customStart && customEnd) {
                                    setTimePeriod('Custom')
                                    setIsCustomDialogOpen(false)
                                } else {
                                    toast.error('Please select both dates')
                                }
                            }}
                            className="rounded-xl bg-[#1a1a1a] text-white hover:bg-black dark:bg-[#FACC15] dark:text-black dark:hover:bg-yellow-500"
                        >
                            Apply Filter
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    )
}
