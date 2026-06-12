'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
    Key, 
    Plus, 
    Trash2, 
    Copy, 
    Check, 
    AlertCircle, 
    Zap, 
    Shield, 
    Clock, 
    ExternalLink,
    Code2,
    BookOpen,
    Settings2,
    CheckCircle2,
    Lock
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { Separator } from '@/components/ui/separator'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gamerplug.com').replace(/\/$/, '')

export default function DeveloperPage() {
    const [keys, setKeys] = useState<any[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [newKeyName, setNewKeyName] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const [revealedKey, setRevealedKey] = useState<string | null>(null)
    const [copied, setCopied] = useState(false)

    useEffect(() => {
        fetchKeys()
    }, [])

    const fetchKeys = async () => {
        setIsLoading(true)
        try {
            const res = await fetch('/api/user/api-keys')
            if (!res.ok) throw new Error('Failed to fetch keys')
            const data = await res.json()
            setKeys(data)
        } catch (error) {
            toast.error('Could not load API keys')
        } finally {
            setIsLoading(false)
        }
    }

    const generateNewKey = async () => {
        if (!newKeyName.trim()) {
            toast.error('Please enter a name for the key')
            return
        }

        setIsGenerating(true)
        try {
            const res = await fetch('/api/user/api-keys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newKeyName })
            })

            if (!res.ok) throw new Error('Failed to generate key')
            
            const data = await res.json()
            setRevealedKey(data.plain_text_key)
            setNewKeyName('')
            fetchKeys()
            toast.success('API key generated successfully')
        } catch (error) {
            toast.error('Failed to generate API key')
        } finally {
            setIsGenerating(false)
        }
    }

    const deleteKey = async (id: string) => {
        if (!confirm('Are you sure you want to delete this API key? This will immediately revoke access for any applications using it.')) {
            return
        }

        try {
            const res = await fetch(`/api/user/api-keys?id=${id}`, {
                method: 'DELETE'
            })

            if (!res.ok) throw new Error('Failed to delete key')
            
            fetchKeys()
            toast.success('API key deleted')
        } catch (error) {
            toast.error('Failed to delete API key')
        }
    }

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast.success('API key copied to clipboard')
    }

    return (
        <div className="space-y-8 max-w-5xl pb-12 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Developer API</h1>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Connect your website or app to our platform</p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge className="bg-primary/10 text-primary border-primary/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest">v1.0 Stable</Badge>
                </div>
            </div>

            {/* API Key Generation Card */}
            <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group transition-all bg-white dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl border-slate-200 dark:border-white/5">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
                
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 shadow-inner border border-primary/20">
                            <Key className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">API Management</h2>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Generate keys to authenticate your requests</p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 mb-8">
                        <div className="flex-1">
                            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1 mb-2 block">Key Name</Label>
                            <Input 
                                placeholder="e.g. My Website API" 
                                value={newKeyName}
                                onChange={(e) => setNewKeyName(e.target.value)}
                                className="h-12 bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-base"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button 
                                onClick={generateNewKey} 
                                disabled={isGenerating || !newKeyName}
                                className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs gradient-primary hover:glow-primary shadow-xl w-full sm:w-auto"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Generate New Key
                            </Button>
                        </div>
                    </div>

                    {revealedKey && (
                        <div className="mb-8 p-6 rounded-2xl bg-emerald-500/10 border-2 border-emerald-500/20 animate-in fade-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-2 mb-3 text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="text-sm font-black uppercase tracking-widest">New API Key Generated Successfully</span>
                            </div>
                            <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300/80 mb-4 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                IMPORTANT: Copy this key now. For security, it will NOT be shown again.
                            </p>
                            <div className="flex items-center gap-2 bg-white dark:bg-black/60 p-3 rounded-xl border border-emerald-500/30 shadow-inner">
                                <code className="flex-1 font-mono text-sm break-all font-bold text-slate-900 dark:text-white select-all">
                                    {revealedKey}
                                </code>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    onClick={() => copyToClipboard(revealedKey)}
                                    className="h-10 w-10 shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                                >
                                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                </Button>
                            </div>
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="mt-4 text-[10px] font-black uppercase tracking-widest h-8 bg-white dark:bg-transparent border-emerald-500/20"
                                onClick={() => setRevealedKey(null)}
                            >
                                I have saved this key
                            </Button>
                        </div>
                    )}

                    <div className="space-y-4">
                        <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1 block mb-2">Existing Keys</Label>
                        {isLoading ? (
                            <div className="flex items-center justify-center p-12">
                                <Zap className="w-8 h-8 text-primary/20 animate-pulse" />
                            </div>
                        ) : keys.length === 0 ? (
                            <div className="text-center p-12 rounded-2xl border-2 border-dashed border-slate-100 dark:border-white/5">
                                <p className="text-slate-500 font-bold">No API keys found. Generate one to get started.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {keys.map((key) => (
                                    <div key={key.id} className="p-4 rounded-2xl bg-slate-50/50 dark:bg-black/40 border border-slate-100 dark:border-white/5 hover:bg-white dark:hover:bg-white/5 transition-all shadow-sm group/key relative">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="min-w-0">
                                                <h3 className="font-black text-slate-900 dark:text-white tracking-tight truncate pr-8">{key.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge className={cn(
                                                        "text-[9px] font-black tracking-widest uppercase px-2 py-0",
                                                        key.is_active ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-red-500/10 text-red-600 border-red-500/20"
                                                    )}>
                                                        {key.is_active ? 'Active' : 'Revoked'}
                                                    </Badge>
                                                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        Created {formatDate(key.created_at)}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button 
                                                size="icon" 
                                                variant="ghost" 
                                                className="absolute top-2 right-2 h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover/key:opacity-100 transition-opacity"
                                                onClick={() => deleteKey(key.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <div className="bg-white dark:bg-black/60 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/5 flex items-center justify-between">
                                            <code className="text-xs font-mono text-slate-500 dark:text-slate-400">{key.key_preview}</code>
                                            <Badge variant="outline" className="text-[8px] font-bold tracking-tighter bg-slate-50 dark:bg-transparent px-1.5 h-4">
                                                ID: {key.id.substring(0, 8)}
                                            </Badge>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between">
                                            <div className="text-[10px] font-bold text-slate-400">
                                                Last used: {key.last_used_at ? formatDate(key.last_used_at) : 'Never'}
                                            </div>
                                            <div className="text-[10px] font-bold text-primary flex items-center gap-1">
                                                <Lock className="w-3 h-3" />
                                                Rate: {key.rate_limit_override || 60} RPM
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Quick Start / Documentation Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-[2rem] p-6 border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl relative overflow-hidden group col-span-1 md:col-span-2">
                     <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2.5 rounded-xl bg-orange-500/10 dark:bg-orange-500/20 shadow-inner border border-orange-500/20">
                                <BookOpen className="w-6 h-6 text-orange-500" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Quick Start</h2>
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Integrate the API in minutes</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">1</div>
                                    Authentication
                                </h3>
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                                    All requests must include your API Key in the <code className="bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-primary">Authorization</code> header as a Bearer token.
                                </p>
                                <div className="bg-black/90 p-4 rounded-xl font-mono text-[11px] text-white shadow-2xl relative group/code overflow-x-auto mx-7">
                                    <pre className="text-emerald-400">Authorization: Bearer YOUR_API_KEY</pre>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px]">2</div>
                                    Base Endpoint
                                </h3>
                                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 pl-7 leading-relaxed">
                                    Use the following base URL for all v1 API calls:
                                </p>
                                <div className="bg-black/90 p-4 rounded-xl font-mono text-[11px] text-white shadow-2xl relative group/code overflow-x-auto mx-7">
                                    <pre className="text-cyan-400">{BASE_URL}/api/v1</pre>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center gap-4 pl-7">
                                <Link 
                                    href="/dashboard/developer/docs" 
                                    className="text-primary font-black uppercase tracking-widest text-[10px] p-0 h-auto flex items-center gap-1.5 hover:underline decoration-2 underline-offset-4"
                                >
                                    View Full API Docs <ExternalLink className="w-3.5 h-3.5" />
                                </Link>
                                <Separator orientation="vertical" className="h-4 bg-slate-200 dark:bg-white/10" />
                                <Button variant="link" className="text-slate-500 hover:text-slate-900 dark:hover:text-white font-black uppercase tracking-widest text-[10px] p-0 h-auto flex items-center gap-1.5 opacity-50 cursor-not-allowed">
                                    Download SDK <Code2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                     </div>
                </div>

                <div className="space-y-6">
                    <div className="glass-card rounded-[2rem] p-6 border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm relative overflow-hidden group">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2.5 rounded-xl bg-cyan-500/10 shadow-inner">
                                <Shield className="w-5 h-5 text-cyan-600" />
                            </div>
                            <h3 className="font-black text-slate-900 dark:text-white tracking-tight">Security</h3>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">Server-side keys are hashed using SHA-256</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">HTTPS only for all requests</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-tight">Rate limiting protection by default</span>
                            </li>
                        </ul>
                    </div>

                    <div className="glass-card rounded-[2rem] p-6 border-slate-200 dark:border-white/5 bg-emerald-500/5 backdrop-blur-md shadow-sm relative overflow-hidden group group-hover:bg-emerald-500/10 transition-colors">
                        <div className="flex items-center gap-3 mb-2 text-emerald-600 dark:text-emerald-400">
                            <Settings2 className="w-5 h-5" />
                            <h3 className="font-black tracking-tight text-emerald-700 dark:text-emerald-400">Need higher limits?</h3>
                        </div>
                        <p className="text-[11px] font-bold text-emerald-800/60 dark:text-emerald-400/60 leading-relaxed mb-4">
                            If your application requires more than 60 requests per minute, please reach out to our support team for a limit upgrade.
                        </p>
                        <Button className="w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[10px] border-0">
                            Contact Support
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
