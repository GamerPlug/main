'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
    ChevronLeft, 
    Copy, 
    Check, 
    Globe, 
    Lock, 
    Zap, 
    ArrowRight, 
    Code2,
    BookOpen,
    Info,
    Server,
    Activity,
    Clock,
    Settings2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const DOCS_CONTENT = [
    {
        id: 'auth',
        title: 'Authentication',
        description: 'All API requests must include an authentication token in the request header.',
        method: 'HEADER',
        endpoint: 'Authorization: Bearer <your_api_key>',
        details: 'API keys are managed in the Developer API section of your dashboard. Treat your API keys as passwords—keep them secret and never share them.',
        curl: `curl -X GET "https://easydata.it.com/api/v1/user/balance" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `const response = await fetch('https://easydata.it.com/api/v1/user/balance', {
  headers: {
    'Authorization': 'Bearer easy_live_...'
  }
});
const data = await response.json();`
    },
    {
        id: 'balance',
        title: 'Check Balance',
        description: 'Retrieve your current wallet balance and total life-time spending.',
        method: 'GET',
        endpoint: '/user/balance',
        details: 'Returns your current wallet balance in GHS (Ghana Cedis).',
        curl: `curl -X GET "https://easydata.it.com/api/v1/user/balance" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `fetch('https://easydata.it.com/api/v1/user/balance', {
  headers: {
    'Authorization': 'Bearer easy_live_...'
  }
})
.then(res => res.json())
.then(data => console.log(data));`,
        response: `{
  "userId": "uuid",
  "balance": 150.50,
  "total_spent": 1200.00,
  "currency": "GHS",
  "last_updated": "2024-03-20T10:00:00Z"
}`
    },
    {
        id: 'packages',
        title: 'List Packages',
        description: 'Fetch all available data packages with your personalized pricing.',
        method: 'GET',
        endpoint: '/packages',
        details: 'The prices returned are automatically adjusted based on your user role (Agent, Dealer, etc.).',
        curl: `curl -X GET "https://easydata.it.com/api/v1/packages" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `const res = await fetch('https://easydata.it.com/api/v1/packages', {
  headers: { 'Authorization': 'Bearer easy_live_...' }
});
const { packages } = await res.json();`,
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
}`
    },
    {
        id: 'purchase',
        title: 'Purchase Bundle',
        description: 'Place an order for a data bundle on behalf of a recipient.',
        method: 'POST',
        endpoint: '/orders/purchase',
        details: 'Deducts from your wallet and triggers instant fulfillment. includes an optional idempotencyKey to prevent duplicate orders.',
        curl: `curl -X POST "https://easydata.it.com/api/v1/orders/purchase" \\
  -H "Authorization: Bearer easy_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "packageId": "uuid",
    "phoneNumber": "0240000000",
    "idempotencyKey": "unique_string_123"
  }'`,
        javascript: `await fetch('https://easydata.it.com/api/v1/orders/purchase', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer easy_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    packageId: "uuid",
    phoneNumber: "0240000000",
    idempotencyKey: "unique_client_ref_001"
  })
});`,
        response: `{
  "success": true,
  "order": {
    "id": "uuid",
    "reference_code": "ED-XXXX",
    "status": "pending",
    "amount": 5.50,
    "network": "MTN",
    "size": "1GB",
    "phone": "0240000000"
  },
  "new_balance": 145.00
}`
    },
    {
        id: 'status',
        title: 'Order Status',
        description: 'Check the real-time status of any order you have placed.',
        method: 'GET',
        endpoint: '/orders/status?reference=ED-XXXX',
        details: 'Search by internal orderId or the readable reference_code.',
        curl: `curl -X GET "https://easydata.it.com/api/v1/orders/status?reference=ED-XXXX" \\
  -H "Authorization: Bearer easy_live_..."`,
        javascript: `const res = await fetch('https://easydata.it.com/api/v1/orders/status?reference=ED-XXXX', {
  headers: { 'Authorization': 'Bearer easy_live_...' }
});`,
        response: `{
  "order_id": "uuid",
  "status": "completed",
  "payment_status": "paid",
  "network": "MTN",
  "size": "1GB",
  "phone_number": "0240000000"
}`
    }
]

export default function ApiDocsPage() {
    const [activeTab, setActiveTab] = useState('auth')
    const [copiedContent, setCopiedContent] = useState<string | null>(null)

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopiedContent(id)
        toast.success('Snippet copied to clipboard')
        setTimeout(() => setCopiedContent(null), 2000)
    }

    return (
        <div className="min-h-screen space-y-8 max-w-6xl mx-auto pb-20 px-4 pt-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <Link 
                        href="/dashboard/developer" 
                        className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 uppercase tracking-widest mb-4 hover:text-primary transition-colors group"
                    >
                        <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        Back to Developer
                    </Link>
                    <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                        Documentation <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] uppercase font-black tracking-widest h-6 px-3">v1.0 API</Badge>
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-bold mt-2">Comprehensive guide to integrating EasyData API into your ecosystem.</p>
                </div>
            </div>

            <Separator className="bg-slate-200 dark:bg-white/10" />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 space-y-2 sticky top-24 h-fit">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 pl-2 mb-4">Core Reference</p>
                    {DOCS_CONTENT.map((section) => (
                        <button
                            key={section.id}
                            onClick={() => setActiveTab(section.id)}
                            className={cn(
                                "w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group",
                                activeTab === section.id 
                                    ? "bg-primary text-white shadow-lg shadow-primary/20 translate-x-1" 
                                    : "text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                            )}
                        >
                            {section.title}
                            {activeTab === section.id && <ArrowRight className="w-4 h-4 animate-in fade-in slide-in-from-left-2" />}
                        </button>
                    ))}
                    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5 mx-2">
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5">
                            <Info className="w-5 h-5 text-primary mb-2" />
                            <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                                Our API uses REST architectural style and returns JSON-encoded responses.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-3 space-y-12">
                    {DOCS_CONTENT.map((section) => (
                        activeTab === section.id && (
                            <div key={section.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <section className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Badge className={cn(
                                                "font-black tracking-widest text-[10px] px-2 py-0.5",
                                                section.method === 'GET' ? "bg-emerald-500/10 text-emerald-600" :
                                                section.method === 'POST' ? "bg-blue-500/10 text-blue-600" :
                                                section.method === 'HEADER' ? "bg-amber-500/10 text-amber-600" :
                                                "bg-amber-500/10 text-amber-600"
                                            )}>
                                                {section.method}
                                            </Badge>
                                            <code className="text-primary font-black text-sm">{section.endpoint}</code>
                                        </div>
                                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight italic">{section.title}</h2>
                                        <p className="text-slate-600 dark:text-slate-400 font-bold leading-relaxed">{section.description}</p>
                                    </div>

                                    <Card className="border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 backdrop-blur-md">
                                        <CardContent className="p-6">
                                            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                                                <Server className="w-3.5 h-3.5" /> Details
                                            </h4>
                                            <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                                                {section.details}
                                            </p>

                                            <Tabs defaultValue="curl" className="w-full">
                                                <div className="flex items-center justify-between mb-2">
                                                    <TabsList className="bg-slate-100 dark:bg-black/60 p-1 h-9 rounded-lg">
                                                        <TabsTrigger value="curl" className="text-[10px] font-black uppercase tracking-widest px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm">cURL</TabsTrigger>
                                                        <TabsTrigger value="javascript" className="text-[10px] font-black uppercase tracking-widest px-3 data-[state=active]:bg-white dark:data-[state=active]:bg-white/10 data-[state=active]:shadow-sm">JavaScript</TabsTrigger>
                                                    </TabsList>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        onClick={() => copyToClipboard(section.curl, section.id)}
                                                        className="h-8 text-[10px] font-black uppercase tracking-widest gap-2 text-slate-400 hover:text-primary"
                                                    >
                                                        {copiedContent === section.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                                        Copy
                                                    </Button>
                                                </div>
                                                <TabsContent value="curl" className="mt-0">
                                                    <div className="bg-slate-900 dark:bg-black/60 p-4 rounded-xl font-mono text-[11px] text-white shadow-2xl overflow-x-auto">
                                                        <pre className="text-emerald-400">{section.curl}</pre>
                                                    </div>
                                                </TabsContent>
                                                <TabsContent value="javascript" className="mt-0">
                                                    <div className="bg-slate-900 dark:bg-black/60 p-4 rounded-xl font-mono text-[11px] text-white shadow-2xl overflow-x-auto">
                                                        <pre className="text-blue-400">{section.javascript}</pre>
                                                    </div>
                                                </TabsContent>
                                            </Tabs>

                                            {section.response && (
                                                <div className="mt-8">
                                                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                                                        <Activity className="w-3.5 h-3.5" /> Example Response
                                                    </h4>
                                                    <div className="bg-slate-50 dark:bg-black/40 p-4 rounded-xl font-mono text-[11px] border border-slate-200 dark:border-white/5 overflow-x-auto">
                                                        <pre className="text-slate-600 dark:text-slate-300">{section.response}</pre>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <div className="pt-8 border-t border-dashed border-slate-200 dark:border-white/5">
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <Clock className="w-3 h-3" /> Request Timeout: 10s
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <Globe className="w-3 h-3" /> Response Encoding: JSON
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )
                    ))}

                    <div className="mt-20 pt-12 border-t-2 border-slate-100 dark:border-white/5 text-center">
                        <div className="inline-flex flex-col items-center max-w-sm">
                            <div className="p-4 rounded-3xl bg-primary/10 mb-6">
                                <Zap className="w-10 h-10 text-primary" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2 italic">Start Building</h2>
                            <p className="text-sm font-bold text-slate-500 mb-8 leading-relaxed">
                                Our API is built to scale with your business. If you encounter any issues during integration, our engineering team is here to help.
                            </p>
                            <Link href="mailto:support@easydata.com">
                                <Button className="px-8 h-12 rounded-xl gradient-primary font-black uppercase tracking-widest text-xs shadow-xl hover:glow-primary">
                                    Contact API Support
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
