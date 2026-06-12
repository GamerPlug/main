'use client'

import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertCircle,
    Loader2,
    MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'

type FilterKey = 'all' | 'pending' | 'in_review' | 'resolved' | 'rejected'

const STATUS_TABS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'in_review', label: 'In Review' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'rejected', label: 'Rejected' },
]

function getStatusConfig(status: string) {
    switch (status) {
        case 'resolved':
            return {
                icon: <CheckCircle2 className="w-4 h-4" />,
                iconLg: <CheckCircle2 className="w-5 h-5" />,
                color: 'text-emerald-600 dark:text-emerald-400',
                bg: 'bg-emerald-500/10 border-emerald-500/20',
                glow: 'bg-emerald-500/5 dark:bg-emerald-500/10',
                badge: 'completed' as const,
            }
        case 'rejected':
            return {
                icon: <XCircle className="w-4 h-4" />,
                iconLg: <XCircle className="w-5 h-5" />,
                color: 'text-rose-600 dark:text-rose-400',
                bg: 'bg-rose-500/10 border-rose-500/20',
                glow: 'bg-rose-500/5 dark:bg-rose-500/10',
                badge: 'failed' as const,
            }
        case 'in_review':
            return {
                icon: <Clock className="w-4 h-4" />,
                iconLg: <Clock className="w-5 h-5" />,
                color: 'text-blue-600 dark:text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
                glow: 'bg-blue-500/5 dark:bg-blue-500/10',
                badge: 'processing' as const,
            }
        default:
            return {
                icon: <AlertCircle className="w-4 h-4" />,
                iconLg: <AlertCircle className="w-5 h-5" />,
                color: 'text-amber-600 dark:text-amber-400',
                bg: 'bg-amber-500/10 border-amber-500/20',
                glow: 'bg-amber-500/5 dark:bg-amber-500/10',
                badge: 'pending' as const,
            }
    }
}

export default function AdminComplaintsPage() {
    const [complaints, setComplaints] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedComplaint, setSelectedComplaint] = useState<any>(null)
    const [resolutionNotes, setResolutionNotes] = useState('')
    const [isResolving, setIsResolving] = useState(false)
    const [activeFilter, setActiveFilter] = useState<FilterKey>('all')

    useEffect(() => {
        fetchComplaints()
    }, [])

    useEffect(() => {
        const channel = supabase
            .channel('admin-complaints')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, () => {
                fetchComplaints()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    const fetchComplaints = async () => {
        try {
            const response = await fetch('/api/admin/complaints')
            if (!response.ok) throw new Error('Failed to fetch complaints')
            const data = await response.json()
            setComplaints(data || [])
        } catch (error) {
            console.error('Error fetching complaints:', error)
            toast.error('Failed to load complaints')
        } finally {
            setLoading(false)
        }
    }

    const stats = useMemo(() => ({
        total: complaints.length,
        pending: complaints.filter(c => c.status === 'pending').length,
        in_review: complaints.filter(c => c.status === 'in_review').length,
        resolved: complaints.filter(c => c.status === 'resolved').length,
        rejected: complaints.filter(c => c.status === 'rejected').length,
    }), [complaints])

    const filtered = useMemo(() =>
        activeFilter === 'all' ? complaints : complaints.filter(c => c.status === activeFilter),
        [complaints, activeFilter]
    )

    const handleResolve = async (status: 'resolved' | 'rejected') => {
        if (!selectedComplaint) return
        setIsResolving(true)
        try {
            const response = await fetch('/api/admin/complaints/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedComplaint.id,
                    status,
                    resolution_notes: resolutionNotes,
                    user_id: selectedComplaint.user_id,
                    order_ref: selectedComplaint.orders?.reference_code,
                }),
            })

            if (!response.ok) {
                const err = await response.json()
                throw new Error(err.error || 'Failed to update complaint')
            }

            setComplaints(prev =>
                prev.map(c =>
                    c.id === selectedComplaint.id
                        ? { ...c, status, resolution_notes: resolutionNotes, updated_at: new Date().toISOString() }
                        : c
                )
            )
            toast.success(`Complaint marked as ${status}`)
            closeDialog()
        } catch (error: any) {
            console.error('Failed to update complaint:', error)
            toast.error(error?.message || 'Failed to update complaint')
        } finally {
            setIsResolving(false)
        }
    }

    const closeDialog = () => {
        setSelectedComplaint(null)
        setResolutionNotes('')
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-2xl" />
                    ))}
                </div>
                <Skeleton className="h-12 rounded-xl" />
                <div className="space-y-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-36 rounded-[2rem]" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 lg:space-y-8 relative z-10">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">
                    Complaints
                </h1>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                    Review and resolve user issue reports
                </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {([
                    { label: 'Total', value: stats.total, icon: <MessageSquare className="w-5 h-5" />, accent: 'blue' },
                    { label: 'Pending', value: stats.pending, icon: <AlertCircle className="w-5 h-5" />, accent: 'amber' },
                    { label: 'In Review', value: stats.in_review, icon: <Clock className="w-5 h-5" />, accent: 'blue' },
                    { label: 'Resolved', value: stats.resolved, icon: <CheckCircle2 className="w-5 h-5" />, accent: 'emerald' },
                    { label: 'Rejected', value: stats.rejected, icon: <XCircle className="w-5 h-5" />, accent: 'rose' },
                ] as const).map(({ label, value, icon, accent }) => (
                    <div
                        key={label}
                        className="glass-card p-4 rounded-2xl bg-white/50 dark:bg-black/40 border border-slate-200 dark:border-white/5 shadow-sm relative overflow-hidden group"
                    >
                        <div className={`absolute top-0 right-0 w-20 h-20 bg-${accent}-500/5 dark:bg-${accent}-500/10 rounded-full blur-2xl pointer-events-none`} />
                        <div className={`w-8 h-8 rounded-lg bg-${accent}-500/10 flex items-center justify-center text-${accent}-600 dark:text-${accent}-400 mb-3 relative z-10`}>
                            {icon}
                        </div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white relative z-10">{value}</p>
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest relative z-10">{label}</p>
                    </div>
                ))}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {STATUS_TABS.map(tab => {
                    const count = tab.key !== 'all' ? stats[tab.key] : null
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
                            {count !== null && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${isActive
                                    ? 'bg-white/20 text-primary-foreground'
                                    : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                                    }`}>
                                    {count}
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Complaints List */}
            {filtered.length === 0 ? (
                <div className="glass-card p-12 text-center rounded-[2rem] border-slate-200 dark:border-white/5 flex flex-col items-center justify-center bg-white/50 dark:bg-black/40 shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center mb-4 shadow-inner">
                        <MessageSquare className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                    </div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">No complaints found</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {activeFilter === 'all'
                            ? 'No complaints have been filed in the last 3 days'
                            : `No ${activeFilter.replaceAll('_', ' ')} complaints`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filtered.map(complaint => {
                        const cfg = getStatusConfig(complaint.status)
                        const isActionable = complaint.status === 'pending' || complaint.status === 'in_review'

                        return (
                            <div
                                key={complaint.id}
                                className="glass-card p-5 sm:p-6 rounded-[2rem] border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm hover:shadow-xl transition-all duration-300 relative overflow-hidden group"
                            >
                                <div className={`absolute top-0 right-0 w-40 h-40 ${cfg.glow} rounded-full blur-3xl pointer-events-none`} />

                                <div className="flex flex-col sm:flex-row sm:items-start gap-4 relative z-10">
                                    {/* Status icon */}
                                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 border ${cfg.bg} ${cfg.color} shadow-inner`}>
                                        {cfg.icon}
                                    </div>

                                    {/* Main content */}
                                    <div className="flex-1 min-w-0">
                                        {/* User row */}
                                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                                            <span className="font-black text-slate-900 dark:text-white">
                                                {complaint.users?.first_name} {complaint.users?.last_name}
                                            </span>
                                            <Badge variant={cfg.badge} className="text-[10px]">
                                                {complaint.status.replaceAll('_', ' ')}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{complaint.users?.email}</p>

                                        {/* Issue */}
                                        <h3 className="font-bold text-slate-800 dark:text-white/90 mb-1 truncate">{complaint.title}</h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">{complaint.description}</p>

                                        {/* Order meta row */}
                                        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                                            <span className="font-mono text-xs text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md">
                                                {complaint.orders?.reference_code}
                                            </span>
                                            <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                                                {complaint.orders?.network} · {complaint.orders?.size}
                                            </span>
                                            <span className="font-mono text-xs text-slate-500">
                                                {complaint.orders?.phone_number}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
                                                {formatDate(complaint.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Action button */}
                                    <div className="flex-shrink-0 self-start sm:self-center">
                                        <Button
                                            size="sm"
                                            variant={isActionable ? 'default' : 'outline'}
                                            className="rounded-xl font-bold"
                                            onClick={() => setSelectedComplaint(complaint)}
                                        >
                                            {isActionable ? 'Resolve' : 'Details'}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Resolution / Details Dialog */}
            <Dialog open={!!selectedComplaint} onOpenChange={closeDialog}>
                <DialogContent className="max-w-lg rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black">
                            {selectedComplaint?.status === 'pending' || selectedComplaint?.status === 'in_review'
                                ? 'Resolve Complaint'
                                : 'Complaint Details'}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-1">
                        {/* User & Order */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">User</p>
                                <p className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                                    {selectedComplaint?.users?.first_name} {selectedComplaint?.users?.last_name}
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5">{selectedComplaint?.users?.email}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Order</p>
                                <p className="font-mono text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                    {selectedComplaint?.orders?.reference_code || '—'}
                                </p>
                                <p className="text-xs text-slate-500 capitalize mt-0.5">
                                    {selectedComplaint?.orders?.network} · {selectedComplaint?.orders?.size}
                                </p>
                            </div>
                        </div>

                        {/* Complaint body */}
                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">
                                    {selectedComplaint?.title}
                                </h4>
                                {selectedComplaint && (
                                    <Badge variant={getStatusConfig(selectedComplaint.status).badge} className="flex-shrink-0 text-[10px]">
                                        {selectedComplaint.status.replaceAll('_', ' ')}
                                    </Badge>
                                )}
                            </div>
                            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                                {selectedComplaint?.description}
                            </p>
                        </div>

                        {/* Resolution input or display */}
                        {(selectedComplaint?.status === 'pending' || selectedComplaint?.status === 'in_review') ? (
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                    Resolution Notes
                                </label>
                                <Textarea
                                    placeholder="Explain the resolution or rejection reason..."
                                    value={resolutionNotes}
                                    onChange={e => setResolutionNotes(e.target.value)}
                                    rows={3}
                                    className="rounded-xl resize-none"
                                />
                            </div>
                        ) : selectedComplaint?.resolution_notes ? (
                            <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500 rounded-l-xl" />
                                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1 pl-2">
                                    Resolution Notes
                                </p>
                                <p className="text-sm text-slate-900 dark:text-white/90 pl-2">
                                    {selectedComplaint.resolution_notes}
                                </p>
                            </div>
                        ) : null}
                    </div>

                    <DialogFooter className="gap-2">
                        {(selectedComplaint?.status === 'pending' || selectedComplaint?.status === 'in_review') ? (
                            <>
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => handleResolve('rejected')}
                                    disabled={isResolving}
                                >
                                    {isResolving
                                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        : <XCircle className="w-4 h-4 mr-2" />}
                                    Reject
                                </Button>
                                <Button
                                    className="rounded-xl"
                                    onClick={() => handleResolve('resolved')}
                                    disabled={isResolving}
                                >
                                    {isResolving
                                        ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                    Mark Resolved
                                </Button>
                            </>
                        ) : (
                            <Button variant="outline" className="rounded-xl" onClick={closeDialog}>
                                Close
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
