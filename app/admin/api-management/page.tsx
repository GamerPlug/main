'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
    Key, Trash2, Zap, Clock, Search, RefreshCw,
    Edit3, CheckCircle2, XCircle, User, ShieldAlert,
    Activity, TrendingUp, Shield
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
    Dialog, DialogContent, DialogDescription,
    DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'

export default function AdminApiManagementPage() {
    const [keys, setKeys] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)
    const [selectedKey, setSelectedKey] = useState<any>(null)
    const [newRateLimit, setNewRateLimit] = useState<number>(60)

    useEffect(() => { fetchKeys() }, [])

    useEffect(() => {
        const channel = supabase
            .channel('admin-api-keys')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'api_keys' }, fetchKeys)
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    const fetchKeys = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/admin/api-management')
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Failed to fetch')
            setKeys(data)
        } catch (error: any) {
            toast.error(error?.message || 'Could not load API keys')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleStatus = async (id: string, current: boolean) => {
        setIsUpdating(true)
        try {
            const res = await fetch('/api/admin/api-management', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !current })
            })
            if (!res.ok) throw new Error('Failed to update')
            fetchKeys()
            toast.success(`Key ${!current ? 'activated' : 'deactivated'}`)
        } catch {
            toast.error('Failed to update key status')
        } finally {
            setIsUpdating(false)
        }
    }

    const updateRateLimit = async () => {
        if (!selectedKey) return
        setIsUpdating(true)
        try {
            const res = await fetch('/api/admin/api-management', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedKey.id, rate_limit_override: newRateLimit })
            })
            if (!res.ok) throw new Error('Failed to update')
            fetchKeys()
            setSelectedKey(null)
            toast.success('Rate limit updated')
        } catch {
            toast.error('Failed to update rate limit')
        } finally {
            setIsUpdating(false)
        }
    }

    const deleteKey = async (id: string) => {
        if (!confirm('Permanently delete this API key? Connected apps will immediately lose access.')) return
        try {
            const res = await fetch(`/api/admin/api-management?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            fetchKeys()
            toast.success('API key deleted')
        } catch {
            toast.error('Failed to delete key')
        }
    }

    const filtered = keys.filter(k =>
        !searchQuery ||
        k.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.users?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        k.key_preview?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const stats = {
        total: keys.length,
        active: keys.filter(k => k.is_active).length,
        inactive: keys.filter(k => !k.is_active).length,
        recentlyUsed: keys.filter(k => k.last_used_at && new Date(k.last_used_at) > new Date(Date.now() - 86400000)).length,
    }

    return (
        <div className="max-w-7xl space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">API Management</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">Monitor and control all system API keys</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchKeys}
                    className="h-9 gap-2 text-xs font-bold rounded-lg border-slate-200 dark:border-white/10"
                >
                    <RefreshCw className={cn('w-3.5 h-3.5', isLoading && 'animate-spin')} />
                    Refresh
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total Keys', value: stats.total, icon: Key, color: 'text-slate-700 dark:text-slate-200' },
                    { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Revoked', value: stats.inactive, icon: XCircle, color: 'text-red-500' },
                    { label: 'Used Today', value: stats.recentlyUsed, icon: Activity, color: 'text-primary' },
                ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="glass-card rounded-xl p-4 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-white/5 flex items-center justify-center shrink-0">
                            <Icon className={cn('w-4.5 h-4.5', color)} />
                        </div>
                        <div>
                            <div className={cn('text-xl font-black leading-none', color)}>{value}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Table card */}
            <div className="glass-card rounded-2xl overflow-hidden">
                {/* Search bar */}
                <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5">
                    <div className="relative max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Search name, email or key…"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-lg text-sm"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 dark:border-white/5">
                                {['Key / User', 'Status', 'Rate Limit', 'Preview', 'Last Used', 'Actions'].map(h => (
                                    <th key={h} className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-white/[0.03]">
                            {isLoading ? (
                                <tr><td colSpan={6} className="py-20 text-center">
                                    <Zap className="w-7 h-7 text-primary/20 animate-pulse mx-auto" />
                                    <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">Loading…</p>
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={6} className="py-20 text-center">
                                    <Key className="w-7 h-7 text-slate-200 dark:text-white/10 mx-auto mb-2" />
                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No keys found</p>
                                </td></tr>
                            ) : filtered.map(key => (
                                <tr key={key.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center shrink-0">
                                                <User className="w-4 h-4 text-slate-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-slate-900 dark:text-white text-xs truncate max-w-[140px]">{key.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[140px]">{key.users?.email}</p>
                                                <Badge className={cn(
                                                    'text-[9px] font-bold uppercase tracking-wider mt-0.5 px-1.5 h-3.5 leading-none',
                                                    key.users?.role === 'dealer' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' :
                                                    key.users?.role === 'agent' ? 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20' :
                                                    'bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-400'
                                                )}>
                                                    {key.users?.role || 'user'}
                                                </Badge>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <Badge className={cn(
                                            'text-[9px] font-black tracking-widest uppercase px-2 h-5 border',
                                            key.is_active
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                        )}>
                                            {key.is_active ? 'Active' : 'Revoked'}
                                        </Badge>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="text-sm font-black text-slate-900 dark:text-white">{key.rate_limit_override || 60}</div>
                                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">RPM</div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <code className="text-[10px] font-mono bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 px-2 py-0.5 rounded text-slate-500">
                                            {key.key_preview}
                                        </code>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                                            <Clock className="w-3 h-3 text-slate-400" />
                                            {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                                        </div>
                                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{key.id.substring(0, 8)}</div>
                                    </td>
                                    <td className="px-5 py-3.5">
                                        <div className="flex items-center gap-1">
                                            {/* Edit rate limit */}
                                            <button
                                                onClick={() => { setSelectedKey(key); setNewRateLimit(key.rate_limit_override || 60) }}
                                                className="p-1.5 rounded-md text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors"
                                                title="Edit rate limit"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" />
                                            </button>
                                            {/* Toggle active */}
                                            <button
                                                onClick={() => toggleStatus(key.id, key.is_active)}
                                                disabled={isUpdating}
                                                className={cn(
                                                    'p-1.5 rounded-md transition-colors',
                                                    key.is_active
                                                        ? 'text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                                        : 'text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                                )}
                                                title={key.is_active ? 'Revoke key' : 'Activate key'}
                                            >
                                                {key.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                            </button>
                                            {/* Delete */}
                                            <button
                                                onClick={() => deleteKey(key.id)}
                                                className="p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                title="Delete key"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!isLoading && filtered.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {filtered.length} of {keys.length} keys
                        </span>
                    </div>
                )}
            </div>

            {/* Rate limit dialog */}
            <Dialog open={!!selectedKey} onOpenChange={open => !open && setSelectedKey(null)}>
                <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-2xl max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black tracking-tight">Edit Rate Limit</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Adjusting limit for <strong className="text-slate-700 dark:text-slate-300">{selectedKey?.name}</strong>
                            <br /><span className="text-xs">{selectedKey?.users?.email}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Requests Per Minute</Label>
                        <Input
                            type="number"
                            min={1}
                            max={10000}
                            value={newRateLimit}
                            onChange={e => setNewRateLimit(parseInt(e.target.value) || 60)}
                            className="h-10 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-lg font-bold"
                        />
                        <div className="flex gap-2 mt-3">
                            {[60, 300, 1000].map(v => (
                                <button
                                    key={v}
                                    onClick={() => setNewRateLimit(v)}
                                    className={cn(
                                        'flex-1 text-[10px] font-black uppercase tracking-widest py-1.5 rounded-lg border transition-colors',
                                        newRateLimit === v
                                            ? 'bg-primary text-white border-primary'
                                            : 'border-slate-200 dark:border-white/10 text-slate-500 hover:border-primary/30'
                                    )}
                                >
                                    {v} RPM
                                </button>
                            ))}
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" size="sm" onClick={() => setSelectedKey(null)} className="h-9 rounded-lg font-black text-xs uppercase tracking-widest">
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={updateRateLimit}
                            disabled={isUpdating}
                            className="h-9 px-6 rounded-lg font-black text-xs uppercase tracking-widest gradient-primary hover:glow-primary"
                        >
                            {isUpdating ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Warning notice */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 max-w-2xl">
                <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] font-medium text-amber-800/80 dark:text-amber-400/80 leading-relaxed">
                    Revoking a key immediately disconnects any external services using it. Only delete keys when explicitly requested or in the case of a security breach.
                </p>
            </div>
        </div>
    )
}
