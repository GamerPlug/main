'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
    Key, Plus, Trash2, Copy, Check, AlertCircle,
    Zap, Clock, ExternalLink, BookOpen, Shield,
    CheckCircle2, Activity, ToggleLeft, ToggleRight
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gamerplug.com').replace(/\/$/, '')

export default function DeveloperPage() {
    const [keys, setKeys] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [newKeyName, setNewKeyName] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [revealedKey, setRevealedKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => { fetchKeys() }, [])

    const fetchKeys = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/user/api-keys')
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Failed to fetch keys')
            setKeys(data)
        } catch (error: any) {
            toast.error(error?.message || 'Could not load API keys')
        } finally {
            setIsLoading(false)
        }
    }

    const generateNewKey = async () => {
        if (!newKeyName.trim()) { toast.error('Enter a name for this key'); return }
        setIsGenerating(true)
        try {
            const res = await fetch('/api/user/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data?.error || 'Failed to generate key')
            setRevealedKey(data.plain_text_key)
            setNewKeyName('')
            fetchKeys()
            toast.success('API key generated')
        } catch (error: any) {
            toast.error(error?.message || 'Failed to generate API key')
        } finally {
            setIsGenerating(false)
        }
    }

    const deleteKey = async (id: string) => {
        if (!confirm('Delete this API key? Any apps using it will immediately lose access.')) return
        try {
            const res = await fetch(`/api/user/api-keys?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            fetchKeys()
            toast.success('API key deleted')
        } catch {
            toast.error('Failed to delete API key')
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success('Copied to clipboard')
    }

    const activeKeys = keys.filter(k => k.is_active).length

    return (
        <div className="max-w-4xl space-y-6 pb-16">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Developer API</h1>
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest px-2 h-5">v1 Stable</Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Connect your platform to GamerPlug programmatically.</p>
                </div>
                <Link href="/dashboard/developer/docs">
                    <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-bold rounded-lg border-slate-200 dark:border-white/10">
                        <BookOpen className="w-3.5 h-3.5" /> API Docs
                        <ExternalLink className="w-3 h-3 opacity-50" />
                    </Button>
                </Link>
            </div>

            {/* Stats row */}
            {!isLoading && keys.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total Keys', value: keys.length, color: 'text-slate-900 dark:text-white' },
                        { label: 'Active', value: activeKeys, color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Default RPM', value: 60, color: 'text-primary' },
                    ].map(stat => (
                        <div key={stat.label} className="glass-card rounded-xl p-4 text-center">
                            <div className={cn('text-2xl font-black', stat.color)}>{stat.value}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{stat.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Generate new key */}
            <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Key className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-900 dark:text-white">Generate API Key</h2>
                        <p className="text-[11px] text-slate-500 font-medium">Give it a name that describes where it will be used</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <Input
                        placeholder="e.g. Production Website"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && generateNewKey()}
                        className="h-10 bg-slate-50 dark:bg-black/30 border-slate-200 dark:border-white/10 rounded-lg text-sm"
                    />
                    <Button
                        onClick={generateNewKey}
                        disabled={isGenerating || !newKeyName.trim()}
                        className="h-10 px-5 rounded-lg font-black text-xs uppercase tracking-widest gradient-primary hover:glow-primary shrink-0"
                    >
                        <Plus className="w-4 h-4 mr-1.5" />
                        {isGenerating ? 'Generating…' : 'Generate'}
                    </Button>
                </div>

                {/* Revealed key banner */}
                {revealedKey && (
                    <div className="mt-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-black uppercase tracking-widest">Key generated — copy it now</span>
                        </div>
                        <p className="text-[11px] font-medium text-emerald-800/70 dark:text-emerald-300/60 mb-3 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            This key will NOT be shown again after you leave this page.
                        </p>
                        <div className="flex items-center gap-2 bg-white dark:bg-black/40 px-3 py-2.5 rounded-lg border border-emerald-200 dark:border-emerald-500/20">
                            <code className="flex-1 text-xs font-mono text-slate-800 dark:text-white break-all select-all">{revealedKey}</code>
                            <button
                                onClick={() => copyToClipboard(revealedKey)}
                                className="shrink-0 p-1.5 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-500/10 text-emerald-600 transition-colors"
                            >
                                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>
                        <button
                            onClick={() => setRevealedKey(null)}
                            className="mt-3 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                        >
                            I've saved this key ✓
                        </button>
                    </div>
                )}
            </div>

            {/* Existing keys */}
            <div className="glass-card rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <h2 className="text-sm font-black text-slate-900 dark:text-white">Your Keys</h2>
                    {!isLoading && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{keys.length} key{keys.length !== 1 ? 's' : ''}</span>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                        <Zap className="w-7 h-7 text-primary/20 animate-pulse" />
                    </div>
                ) : keys.length === 0 ? (
                    <div className="py-16 text-center">
                        <Key className="w-8 h-8 text-slate-200 dark:text-white/10 mx-auto mb-3" />
                        <p className="text-sm font-bold text-slate-400">No API keys yet</p>
                        <p className="text-xs text-slate-400/70 mt-1">Generate your first key above</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {keys.map((key) => (
                            <div key={key.id} className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                        key.is_active ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-slate-100 dark:bg-white/5'
                                    )}>
                                        <Key className={cn('w-4 h-4', key.is_active ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400')} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <span className="text-sm font-black text-slate-900 dark:text-white truncate">{key.name}</span>
                                            <Badge className={cn(
                                                'text-[9px] font-black tracking-wider uppercase px-1.5 h-4',
                                                key.is_active
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                                                    : 'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                            )}>
                                                {key.is_active ? 'Active' : 'Revoked'}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-[10px] font-medium text-slate-400">
                                            <code className="font-mono">{key.key_preview}</code>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {key.last_used_at ? formatDate(key.last_used_at) : 'Never used'}
                                            </span>
                                            <span className="flex items-center gap-1 text-primary font-bold">
                                                <Activity className="w-3 h-3" />
                                                {key.rate_limit_override || 60} RPM
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => deleteKey(key.id)}
                                    className="shrink-0 p-2 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Delete key"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Security + Rate limit info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="glass-card rounded-xl p-4 flex items-start gap-3">
                    <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-white mb-1">Security</h3>
                        <ul className="space-y-1">
                            {['Keys are hashed with SHA-256 — never stored in plain text', 'HTTPS enforced on all API requests', 'Keys are scoped to your account only'].map(item => (
                                <li key={item} className="text-[11px] text-slate-500 font-medium flex items-start gap-1.5">
                                    <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />{item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
                <div className="glass-card rounded-xl p-4 flex items-start gap-3">
                    <Activity className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="text-xs font-black text-slate-900 dark:text-white mb-1">Rate Limits</h3>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                            Default: <strong className="text-slate-700 dark:text-slate-300">60 RPM</strong> for standard endpoints.
                            Bulk orders: <strong className="text-slate-700 dark:text-slate-300">5 requests/min</strong> (up to 100 orders each).
                            Contact support for higher limits.
                        </p>
                    </div>
                </div>
            </div>

            {/* Base URL card */}
            <div className="glass-card rounded-xl p-4">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Base API URL</Label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2.5">
                    <code className="text-xs font-mono text-primary flex-1 select-all">{BASE_URL}/api/v1</code>
                    <button
                        onClick={() => copyToClipboard(`${BASE_URL}/api/v1`)}
                        className="p-1 rounded text-slate-400 hover:text-primary transition-colors"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    )
}
