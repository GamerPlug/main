'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ChevronLeft, Copy, Check, Globe, Lock, Zap, Code2, Server, Activity, Clock, ArrowUpRight, Layers, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://gamerplug.com').replace(/\/$/, '')

const METHOD_STYLES: Record<string, string> = {
    GET: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    POST: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    HEADER: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
}

const ENDPOINTS = [
    {
        id: 'authentication',
        title: 'Authentication',
        method: 'HEADER',
        endpoint: 'Authorization: Bearer <your_api_key>',
        description: 'All API requests must include a valid API key in the Authorization header.',
        details: 'API keys are created from the Developer section of your dashboard. Keep them secret — treat them like passwords. Never expose a key in client-side browser code.',
        curl: `curl -X GET "${BASE_URL}/api/v1/user/balance" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `const res = await fetch('${BASE_URL}/api/v1/user/balance', {
  headers: {
    'Authorization': 'Bearer easy_live_...'
  }
});
const data = await res.json();`,
    },
    {
        id: 'balance',
        title: 'Check Balance',
        method: 'GET',
        endpoint: '/api/v1/user/balance',
        description: 'Retrieve your current wallet balance and lifetime spending.',
        details: 'Returns your wallet balance in GHS (Ghana Cedis). Use this before placing orders to verify sufficient funds.',
        curl: `curl -X GET "${BASE_URL}/api/v1/user/balance" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `const res = await fetch('${BASE_URL}/api/v1/user/balance', {
  headers: { 'Authorization': 'Bearer easy_live_...' }
});
const { balance, currency } = await res.json();`,
        response: `{
  "userId": "uuid",
  "balance": 150.50,
  "total_spent": 1200.00,
  "currency": "GHS",
  "last_updated": "2025-06-12T10:00:00Z"
}`,
    },
    {
        id: 'packages',
        title: 'List Packages',
        method: 'GET',
        endpoint: '/api/v1/packages',
        description: 'Fetch all available data packages with pricing tailored to your account role.',
        details: 'Prices are automatically adjusted for your tier (Agent, Dealer, etc.). Filter by network on the client side using the returned network field.',
        curl: `curl -X GET "${BASE_URL}/api/v1/packages" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `const res = await fetch('${BASE_URL}/api/v1/packages', {
  headers: { 'Authorization': 'Bearer easy_live_...' }
});
const { packages, user_role } = await res.json();`,
        response: `{
  "packages": [
    {
      "id": "uuid",
      "network": "MTN",
      "size": "1GB",
      "price": 5.50,
      "currency": "GHS",
      "is_available": true
    }
  ],
  "user_role": "dealer"
}`,
    },
    {
        id: 'purchase',
        title: 'Purchase Bundle',
        method: 'POST',
        endpoint: '/api/v1/orders/purchase',
        description: 'Place a single data bundle order for a recipient phone number.',
        details: 'Deducts the cost from your wallet atomically and triggers fulfillment. Pass an idempotencyKey to safely retry without creating duplicate orders.',
        curl: `curl -X POST "${BASE_URL}/api/v1/orders/purchase" \\
  -H "Authorization: Bearer easy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "packageId": "uuid",
    "phoneNumber": "0240000000",
    "idempotencyKey": "order_ref_001"
  }'`,
        javascript: `const res = await fetch('${BASE_URL}/api/v1/orders/purchase', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer easy_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    packageId: "uuid",
    phoneNumber: "0240000000",
    idempotencyKey: "order_ref_001"
  })
});
const { order, new_balance } = await res.json();`,
        response: `{
  "success": true,
  "order": {
    "id": "uuid",
    "reference_code": "GP-XXXX",
    "status": "pending",
    "amount": 5.50,
    "network": "MTN",
    "size": "1GB",
    "phone": "0240000000"
  },
  "new_balance": 145.00
}`,
    },
    {
        id: 'bulk',
        title: 'Bulk Purchase',
        method: 'POST',
        endpoint: '/api/v1/orders/bulk',
        description: 'Place up to 100 data bundle orders in a single request.',
        details: 'All orders are validated before any wallet deduction occurs. The wallet is debited atomically for the full total. Rate limited to 5 bulk requests per minute per API key. Any validation failure rejects the entire batch — fix errors and retry.',
        curl: `curl -X POST "${BASE_URL}/api/v1/orders/bulk" \\
  -H "Authorization: Bearer easy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "orders": [
      { "packageId": "uuid-1", "phoneNumber": "0240000000", "idempotencyKey": "ref_001" },
      { "packageId": "uuid-2", "phoneNumber": "0550000000", "idempotencyKey": "ref_002" }
    ]
  }'`,
        javascript: `const res = await fetch('${BASE_URL}/api/v1/orders/bulk', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer easy_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    orders: [
      { packageId: "uuid-1", phoneNumber: "0240000000", idempotencyKey: "ref_001" },
      { packageId: "uuid-2", phoneNumber: "0550000000", idempotencyKey: "ref_002" }
    ]
  })
});
const { summary, orders } = await res.json();`,
        response: `{
  "success": true,
  "summary": {
    "total_orders": 2,
    "total_charged": 11.00,
    "new_balance": 139.00
  },
  "orders": [
    { "id": "uuid", "reference_code": "GP-XXXX", "status": "pending",
      "network": "MTN", "size": "1GB", "amount": 5.50, "phone": "0240000000" },
    { "id": "uuid", "reference_code": "GP-YYYY", "status": "pending",
      "network": "Telecel", "size": "1GB", "amount": 5.50, "phone": "0550000000" }
  ]
}`,
    },
    {
        id: 'order-status',
        title: 'Order Status',
        method: 'GET',
        endpoint: '/api/v1/orders/status?reference=GP-XXXX',
        description: 'Check the fulfillment status of an order by its reference code or ID.',
        details: 'Poll this endpoint after placing an order to track completion. Status values: pending → processing → completed | failed.',
        curl: `curl -X GET "${BASE_URL}/api/v1/orders/status?reference=GP-XXXX" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `const res = await fetch(
  '${BASE_URL}/api/v1/orders/status?reference=GP-XXXX',
  { headers: { 'Authorization': 'Bearer easy_live_...' } }
);
const { status, network, size } = await res.json();`,
        response: `{
  "order_id": "uuid",
  "reference_code": "GP-XXXX",
  "status": "completed",
  "payment_status": "paid",
  "network": "MTN",
  "size": "1GB",
  "amount": 5.50,
  "phone_number": "0240000000",
  "created_at": "2025-06-12T10:00:00Z",
  "updated_at": "2025-06-12T10:01:30Z"
}`,
    },
]

function CodeBlock({ curl, javascript, id }: { curl: string; javascript: string; id: string }) {
    const [copied, setCopied] = useState<string | null>(null)

    const copy = (text: string, type: string) => {
        navigator.clipboard.writeText(text)
        setCopied(type + id)
        toast.success('Copied')
        setTimeout(() => setCopied(null), 2000)
    }

    return (
        <Tabs defaultValue="curl">
            <div className="flex items-center justify-between mb-2">
                <TabsList className="h-8 bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg">
                    <TabsTrigger value="curl" className="h-7 px-3 text-[10px] font-black uppercase tracking-widest rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm">cURL</TabsTrigger>
                    <TabsTrigger value="js" className="h-7 px-3 text-[10px] font-black uppercase tracking-widest rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm">JavaScript</TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="curl" className="mt-0 relative group/code">
                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-[11px] font-mono text-emerald-400 leading-relaxed whitespace-pre">{curl}</pre>
                </div>
                <button
                    onClick={() => copy(curl, 'curl')}
                    className="absolute top-3 right-3 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors opacity-0 group-hover/code:opacity-100"
                >
                    {copied === 'curl' + id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </TabsContent>
            <TabsContent value="js" className="mt-0 relative group/code">
                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-[11px] font-mono text-blue-400 leading-relaxed whitespace-pre">{javascript}</pre>
                </div>
                <button
                    onClick={() => copy(javascript, 'js')}
                    className="absolute top-3 right-3 p-1.5 rounded-md bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors opacity-0 group-hover/code:opacity-100"
                >
                    {copied === 'js' + id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </TabsContent>
        </Tabs>
    )
}

export default function ApiDocsPage() {
    const [activeSection, setActiveSection] = useState('authentication')
    const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) setActiveSection(entry.target.id)
                })
            },
            { rootMargin: '-20% 0px -60% 0px' }
        )
        Object.values(sectionRefs.current).forEach(el => el && observer.observe(el))
        return () => observer.disconnect()
    }, [])

    return (
        <div className="max-w-6xl mx-auto pb-24">
            {/* Header */}
            <div className="mb-8">
                <Link href="/dashboard/developer" className="inline-flex items-center gap-1.5 text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4 hover:text-primary transition-colors group">
                    <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    Developer
                </Link>
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">API Reference</h1>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase tracking-widest px-2 h-5">v1.0</Badge>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-1">REST API — JSON responses — Bearer token auth</p>
            </div>

            <div className="flex gap-8">
                {/* Sticky sidebar nav */}
                <aside className="hidden lg:block w-48 shrink-0">
                    <div className="sticky top-24 space-y-0.5">
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 px-3 pb-2">Endpoints</p>
                        {ENDPOINTS.map(ep => (
                            <a
                                key={ep.id}
                                href={`#${ep.id}`}
                                onClick={e => {
                                    e.preventDefault()
                                    sectionRefs.current[ep.id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                }}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all',
                                    activeSection === ep.id
                                        ? 'text-primary bg-primary/5 dark:bg-primary/10'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5'
                                )}
                            >
                                <Badge className={cn(
                                    'text-[8px] font-black px-1 h-3.5 leading-none border shrink-0',
                                    METHOD_STYLES[ep.method] || METHOD_STYLES.GET
                                )}>
                                    {ep.method === 'HEADER' ? 'AUTH' : ep.method}
                                </Badge>
                                {ep.title}
                            </a>
                        ))}

                        <div className="pt-4 px-3">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
                                <Globe className="w-3 h-3" /> JSON / REST
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1">
                                <Clock className="w-3 h-3" /> 10s timeout
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 mt-1">
                                <Lock className="w-3 h-3" /> HTTPS only
                            </div>
                        </div>
                    </div>
                </aside>

                {/* All endpoints */}
                <div className="flex-1 min-w-0 space-y-10">
                    {ENDPOINTS.map((ep, index) => (
                        <section
                            key={ep.id}
                            id={ep.id}
                            ref={el => { sectionRefs.current[ep.id] = el }}
                            className="scroll-mt-24"
                        >
                            {/* Section header */}
                            <div className="flex items-start gap-3 mb-4">
                                <div className="mt-0.5">
                                    <Badge className={cn(
                                        'text-[9px] font-black tracking-widest uppercase px-2 h-5 border',
                                        METHOD_STYLES[ep.method] || METHOD_STYLES.GET
                                    )}>
                                        {ep.method}
                                    </Badge>
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">{ep.title}</h2>
                                    <code className="text-xs font-mono text-primary">{ep.endpoint}</code>
                                </div>
                            </div>

                            <div className="glass-card rounded-2xl overflow-hidden">
                                {/* Description */}
                                <div className="p-5 border-b border-slate-100 dark:border-white/5">
                                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{ep.description}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed mt-2">{ep.details}</p>
                                    {ep.id === 'bulk' && (
                                        <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg px-3 py-2">
                                            <Layers className="w-3.5 h-3.5 shrink-0" />
                                            Rate limit: 5 requests/min — up to 100 orders per request
                                        </div>
                                    )}
                                </div>

                                {/* Code examples */}
                                <div className="p-5 border-b border-slate-100 dark:border-white/5">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                                        <Code2 className="w-3 h-3" /> Request
                                    </p>
                                    <CodeBlock curl={ep.curl} javascript={ep.javascript} id={ep.id} />
                                </div>

                                {/* Response example */}
                                {ep.response && (
                                    <div className="p-5">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 flex items-center gap-1.5">
                                            <Activity className="w-3 h-3" /> Response
                                        </p>
                                        <div className="bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/5 rounded-xl p-4 overflow-x-auto">
                                            <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-400 leading-relaxed whitespace-pre">{ep.response}</pre>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {index < ENDPOINTS.length - 1 && (
                                <div className="border-b border-dashed border-slate-100 dark:border-white/5 mt-10" />
                            )}
                        </section>
                    ))}

                    {/* Footer CTA */}
                    <div className="pt-6 text-center">
                        <div className="inline-block p-5 glass-card rounded-2xl max-w-sm w-full">
                            <Zap className="w-8 h-8 text-primary mx-auto mb-3" />
                            <h3 className="text-sm font-black text-slate-900 dark:text-white mb-1">Need help integrating?</h3>
                            <p className="text-xs text-slate-500 mb-4 leading-relaxed">Our team is available to assist with your API integration.</p>
                            <Link href="mailto:support@gamerplug.com">
                                <Button size="sm" className="h-9 px-6 rounded-lg gradient-primary font-black uppercase tracking-widest text-[10px] hover:glow-primary">
                                    Contact Support <ArrowUpRight className="w-3 h-3 ml-1" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
