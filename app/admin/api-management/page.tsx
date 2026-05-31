'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
    Key, 
    Trash2, 
    AlertCircle, 
    Zap, 
    Shield, 
    Clock, 
    Settings2,
    CheckCircle2,
    XCircle,
    User,
    Search,
    Filter,
    ShieldAlert,
    RefreshCw,
    Edit3
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog"

export default function AdminApiManagementPage() {
    const [keys, setKeys] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [isUpdating, setIsUpdating] = useState(false)
    const [selectedKey, setSelectedKey] = useState<any>(null)
    const [newRateLimit, setNewRateLimit] = useState<number>(60)

    useEffect(() => {
        fetchKeys()
    }, [])

    // Real-time subscription for live API key updates
    useEffect(() => {
        const channel = supabase
            .channel('admin-api-keys')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'api_keys' }, () => {
                fetchKeys()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchKeys = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/admin/api-management')
            if (!res.ok) throw new Error('Failed to fetch keys')
            const data = await res.json()
            setKeys(data)
        } catch (error) {
            toast.error('Could not load API keys')
        } finally {
            setIsLoading(false)
        }
    }

    const toggleKeyStatus = async (id: string, currentStatus: boolean) => {
        setIsUpdating(true)
        try {
            const res = await fetch('/api/admin/api-management', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, is_active: !currentStatus })
            })

            if (!res.ok) throw new Error('Failed to update status')
            
            fetchKeys()
            toast.success(`API key ${!currentStatus ? 'activated' : 'deactivated'}`)
        } catch (error) {
            toast.error('Failed to update API key status')
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

            if (!res.ok) throw new Error('Failed to update rate limit')
            
            fetchKeys()
            setSelectedKey(null)
            toast.success('Rate limit updated')
        } catch (error) {
            toast.error('Failed to update rate limit')
        } finally {
            setIsUpdating(false)
        }
    }

    const deleteKey = async (id: string) => {
        if (!confirm('Are you sure you want to PERMANENTLY delete this API key? This action cannot be undone.')) {
            return
        }

        try {
            const res = await fetch(`/api/admin/api-management?id=${id}`, {
                method: 'DELETE'
            })

            if (!res.ok) throw new Error('Failed to delete key')
            
            fetchKeys()
            toast.success('API key permanently deleted')
        } catch (error) {
            toast.error('Failed to delete API key')
        }
    }

    const filteredKeys = keys.filter(key => 
        key.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.users?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        key.key_preview?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return (
        <div className="space-y-8 max-w-7xl pb-12 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Global API Management</h1>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Admin control over all system API keys</p>
                </div>
                <Button 
                    variant="outline" 
                    onClick={fetchKeys} 
                    className="h-10 px-4 rounded-xl font-black uppercase tracking-widest text-xs bg-white dark:bg-black/40 border-slate-200 dark:border-white/10"
                >
                    <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Stats Cards */}
                <Card className="glass-card border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest">Total Keys</CardDescription>
                        <CardTitle className="text-3xl font-black">{keys.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="glass-card border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest">Active Keys</CardDescription>
                        <CardTitle className="text-3xl font-black text-emerald-500">{keys.filter(k => k.is_active).length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="glass-card border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest">Inactive Keys</CardDescription>
                        <CardTitle className="text-3xl font-black text-red-500">{keys.filter(k => !k.is_active).length}</CardTitle>
                    </CardHeader>
                </Card>
                 <Card className="glass-card border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest">Last 24h Usage</CardDescription>
                        <CardTitle className="text-3xl font-black text-cyan-500">
                             {keys.filter(k => k.last_used_at && new Date(k.last_used_at) > new Date(Date.now() - 86400000)).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <div className="glass-card rounded-[2rem] overflow-hidden border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 backdrop-blur-md shadow-xl">
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input 
                            placeholder="Search by name, email, or key..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 h-10 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-slate-100 dark:border-white/5 hover:bg-transparent">
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Key Name / User</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Status</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-center">Rate Limit</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Preview</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest">Last Activity</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Zap className="w-8 h-8 text-primary/20 animate-pulse" />
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Loading Keys...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredKeys.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-64 text-center">
                                        <p className="text-slate-400 font-bold uppercase tracking-widest">No API keys found</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredKeys.map((key) => (
                                    <TableRow key={key.id} className="border-slate-100 dark:border-white/5 group">
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10">
                                                    <User className="w-5 h-5 text-slate-400" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-black text-slate-900 dark:text-white leading-tight truncate">{key.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 truncate">{key.users?.email}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge className={cn(
                                                "text-[9px] font-black tracking-widest uppercase px-2 py-0.5",
                                                key.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"
                                            )}>
                                                {key.is_active ? 'Active' : 'Revoked'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm font-black text-slate-700 dark:text-slate-300">{key.rate_limit_override || 60}</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">RPM</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <code className="text-[10px] font-mono bg-slate-50 dark:bg-black/40 px-2 py-1 rounded border border-slate-200 dark:border-white/5 text-slate-500">
                                                {key.key_preview}
                                            </code>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                                                    {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                                                </span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                    ID: {key.id.substring(0, 8)}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10"
                                                    onClick={() => {
                                                        setSelectedKey(key)
                                                        setNewRateLimit(key.rate_limit_override || 60)
                                                    }}
                                                >
                                                    <Edit3 className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className={cn(
                                                        "h-8 w-8",
                                                        key.is_active ? "text-red-400 hover:text-red-500 hover:bg-red-50" : "text-emerald-400 hover:text-emerald-500 hover:bg-emerald-50"
                                                    )}
                                                    onClick={() => toggleKeyStatus(key.id, key.is_active)}
                                                >
                                                    {key.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-100"
                                                    onClick={() => deleteKey(key.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Rate Limit Edit Dialog */}
            <Dialog open={!!selectedKey} onOpenChange={(open) => !open && setSelectedKey(null)}>
                <DialogContent className="glass-card bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-[2rem]">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black tracking-tight">Adjust Rate Limit</DialogTitle>
                        <DialogDescription className="font-bold text-slate-500">
                            Setting a custom rate limit for <strong>{selectedKey?.name}</strong> (User: {selectedKey?.users?.email})
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">Requests Per Minute (RPM)</Label>
                            <Input 
                                type="number"
                                value={newRateLimit}
                                onChange={(e) => setNewRateLimit(parseInt(e.target.value))}
                                className="h-12 bg-slate-50 dark:bg-black/20 border-slate-200 dark:border-white/10 rounded-xl font-bold"
                            />
                            <p className="text-[10px] font-bold text-slate-400 leading-tight">
                                Recommended limits: Standard: 60, Power User: 300, Enterprise: 1000+
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button 
                            variant="outline" 
                            onClick={() => setSelectedKey(null)}
                            className="h-11 px-6 rounded-xl font-black uppercase tracking-widest text-xs"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={updateRateLimit}
                            disabled={isUpdating}
                            className="h-11 px-8 rounded-xl font-black uppercase tracking-widest text-xs gradient-primary hover:glow-primary"
                        >
                            {isUpdating ? "Saving..." : "Update Limit"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Security Notice */}
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 max-w-2xl">
                <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
                <p className="text-[11px] font-bold text-amber-800/80 dark:text-amber-500/80 leading-relaxed">
                    <strong>ADMIN NOTICE:</strong> You are managing system-wide API credentials. Revoking a key will immediately disconnect external services using it. Avoid deleting keys unless explicitly requested by the user or in cases of security breach.
                </p>
            </div>
        </div>
    )
}
