'use client'

import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Complaint } from '@/types/supabase'

interface ComplaintWithOrder extends Complaint {
    orders?: {
        reference_code: string
        phone_number: string
        network: string
        size: string
        price: number
        status: string
    } | null
}

type FilterKey = 'all' | 'active' | 'resolved' | 'rejected'

const FILTER_TABS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'rejected', label: 'Rejected' },
]

function getStatusIcon(status: string) {
    switch (status) {
        case 'resolved':
            return <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
        case 'rejected':
            return <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-500" />
        case 'in_review':
            return <Clock className="w-5 h-5 text-blue-600 dark:text-blue-500" />
        default:
            return <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500" />
    }
}

function getStatusIconBg(status: string) {
    switch (status) {
        case 'resolved': return 'bg-emerald-500/20 border-emerald-500/30'
        case 'rejected': return 'bg-rose-500/20 border-rose-500/30'
        case 'in_review': return 'bg-blue-500/20 border-blue-500/30'
        default: return 'bg-amber-500/20 border-amber-500/30'
    }
}

function getStatusBadgeVariant(status: string): 'pending' | 'processing' | 'completed' | 'failed' {
    const map: Record<string, 'pending' | 'processing' | 'completed' | 'failed'> = {
        pending: 'pending',
        in_review: 'processing',
        resolved: 'completed',
        rejected: 'failed',
    }
    return map[status] ?? 'pending'
}

function computeStats(data: ComplaintWithOrder[]) {
    return {
        total: data.length,
        active: data.filter(c => c.status === 'pending' || c.status === 'in_review').length,
        resolved: data.filter(c => c.status === 'resolved').length,
        rejected: data.filter(c => c.status === 'rejected').length,
    }
}

export default function ComplaintsPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()

    const [complaints, setComplaints] = useState<ComplaintWithOrder[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [stats, setStats] = useState({ total: 0, active: 0, resolved: 0, rejected: 0 })
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) {
                fetchComplaints()
            } else {
                setIsLoading(false)
            }
        }
    }, [dbUser, isAuthLoading])

    const fetchComplaints = async () => {
        try {
            const { data, error } = await supabase
                .from('complaints')
                .select(`
                    *,
                    orders (
                        reference_code,
                        phone_number,
                        network,
                        size,
                        price,
                        status
                    )
                `)
                .eq('user_id', dbUser?.id as any)
                .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())
                .order('created_at', { ascending: false })

            if (error) throw error
            const list = (data as ComplaintWithOrder[]) || []
            setComplaints(list)
            setStats(computeStats(list))
        } catch (error) {
            console.error('Error fetching complaints:', error)
        } finally {
            setIsLoading(false)
        }
    }

    // Real-time updates: single setState to avoid race condition between list and stats
    useEffect(() => {
        if (!dbUser) return

        const subscription = supabase
            .channel('user-complaints')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'complaints',
                    filter: `user_id=eq.${dbUser.id}`,
                },
                payload => {
                    setComplaints(prev => {
                        const updated = prev.map(c =>
                            c.id === payload.new.id ? { ...c, ...payload.new } : c
                        )
                        setStats(computeStats(updated))
                        return updated
                    })
                }
            )
            .subscribe()

        return () => { subscription.unsubscribe() }
    }, [dbUser])

    const filtered = useMemo(() => {
        if (activeFilter === 'all') return complaints
        if (activeFilter === 'active') return complaints.filter(c => c.status === 'pending' || c.status === 'in_review')
        return complaints.filter(c => c.status === activeFilter)
    }, [complaints, activeFilter])

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
                <Skeleton className="h-12 rounded-xl" />
                <Skeleton className="h-96 rounded-[2rem]" />
            </div>
        )
    }

    return (
        <div className="space-y-6 lg:space-y-8 relative z-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">
                        Complaints
                    </h1>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                        Track and manage your issue reports
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                {([
                    { label: 'Total', value: stats.total, icon: <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />, accent: 'blue' },
                    { label: 'Active', value: stats.active, icon: <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />, accent: 'amber' },
                    { label: 'Resolved', value: stats.resolved, icon: <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />, accent: 'emerald' },
                    { label: 'Rejected', value: stats.rejected, icon: <XCircle className="w-6 h-6 text-rose-600 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]" />, accent: 'rose' },
                ] as const).map(({ label, value, icon, accent }) => (
                    <div
                        key={label}
                        className="glass-card p-5 sm:p-6 rounded-[2xl] flex flex-col justify-between relative overflow-hidden group border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 shadow-sm dark:shadow-xl"
                    >
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-${accent}-500/5 dark:bg-${accent}-500/10 rounded-full blur-2xl group-hover:bg-${accent}-500/10 dark:group-hover:bg-${accent}-500/20 transition-colors pointer-events-none`} />
                        <div className="flex items-center gap-4 mb-4 relative z-10">
                            <div className={`w-12 h-12 rounded-xl bg-${accent}-500/10 dark:bg-${accent}-500/20 flex items-center justify-center shadow-inner`}>
                                {icon}
                            </div>
                        </div>
                        <div className="relative z-10">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {FILTER_TABS.map(tab => {
                    const count =
                        tab.key === 'all' ? stats.total
                        : tab.key === 'active' ? stats.active
                        : stats[tab.key as 'resolved' | 'rejected']
                    const isActive = activeFilter === tab.key
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveFilter(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${isActive
                                ? 'bg-primary text-primary-foreground shadow-md'
                                : 'bg-white/50 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-white/10 border border-slate-200 dark:border-white/10'
                                }`}
                        >
                            {tab.label}
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${isActive
                                ? 'bg-white/20 text-primary-foreground'
                                : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                }`}>
                                {count}
                            </span>
                        </button>
                    )
                })}
            </div>

            {/* Complaints List */}
            {filtered.length === 0 ? (
                <div className="glass-card p-12 text-center rounded-[2rem] border-slate-200 dark:border-white/5 flex flex-col items-center justify-center bg-white/50 dark:bg-black/40 shadow-sm dark:shadow-xl">
                    <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-6 shadow-inner">
                        <MessageSquare className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">
                        {activeFilter === 'all' ? 'No Complaints Filed' : `No ${activeFilter === 'active' ? 'active' : activeFilter} complaints`}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto text-sm">
                        {activeFilter === 'all'
                            ? 'If you have an issue with an order, you can file a complaint directly from the My Orders page'
                            : 'Try switching to a different filter to see other complaints'}
                    </p>
                </div>
            ) : (
                <div id="complaint-history" className="space-y-4">
                    {filtered.map(complaint => (
                        <div
                            key={complaint.id}
                            className="glass-card p-5 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 relative overflow-hidden group transition-all duration-300 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm hover:shadow-xl"
                        >
                            {/* Order Details Box */}
                            {complaint.orders && (
                                <div className="mb-5 p-4 rounded-2xl bg-slate-50 dark:bg-black/40 border border-slate-100 dark:border-white/5 shadow-inner">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">Network</p>
                                            <p className="font-black text-slate-900 dark:text-white">{complaint.orders.network}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">Data Size</p>
                                            <p className="font-black text-slate-900 dark:text-white">{complaint.orders.size}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">Phone</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{complaint.orders.phone_number}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1">Order Ref</p>
                                            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{complaint.orders.reference_code}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                                {/* Status icon */}
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-inner ${getStatusIconBg(complaint.status)}`}>
                                    <div className="drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                                        {getStatusIcon(complaint.status)}
                                    </div>
                                </div>

                                <div className="flex-1 w-full">
                                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                                        <div className="space-y-1.5">
                                            <h3 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                                {complaint.title}
                                            </h3>
                                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 leading-relaxed">
                                                {complaint.description}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-start sm:items-end flex-shrink-0">
                                            <div className="bg-slate-50 dark:bg-black/40 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 shadow-inner">
                                                <Badge variant={getStatusBadgeVariant(complaint.status)}>
                                                    {complaint.status.replaceAll('_', ' ')}
                                                </Badge>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mt-3">
                                                {formatDate(complaint.created_at)}
                                            </p>
                                        </div>
                                    </div>

                                    {complaint.resolution_notes && (
                                        <div className="mt-5 p-4 rounded-xl bg-primary/5 border border-primary/10 relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500 rounded-l-xl" />
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 pl-2">
                                                Resolution Notes
                                            </p>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white/90 pl-2">
                                                {complaint.resolution_notes}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
