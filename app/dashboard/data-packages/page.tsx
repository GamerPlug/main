'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { validateGhanaianPhone, detectNetwork } from '@/lib/phone-validation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Loader2, X, Upload, FileSpreadsheet, FileText, Download, Tag } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { DataPackage } from '@/types/supabase'
import { resolvePackagePrice } from '@/lib/pricing'

interface ValidationResult {
    lineNumber: number
    phoneNumber: string
    volume: number
    packagePrice: number
    isValid: boolean
    errorMessage?: string
    packageId?: string
}

type NetworkGroupId = 'MTN' | 'Telecel' | 'AT-BigTime'
type InputMode = 'text' | 'excel'

interface NetworkGroup {
    id: NetworkGroupId
    label: string
    networks: string[]
    abbr: string
    iconBg: string
    iconText: string
    blobColor: string
}

const NETWORK_GROUPS: NetworkGroup[] = [
    {
        id: 'MTN',
        label: 'MTN',
        networks: ['MTN'],
        abbr: 'MTN',
        iconBg: '#F59E0B',
        iconText: '#fff',
        blobColor: 'rgba(245,158,11,0.18)',
    },
    {
        id: 'Telecel',
        label: 'Telecel',
        networks: ['Telecel'],
        abbr: 'TEL',
        iconBg: '#E60000',
        iconText: '#fff',
        blobColor: 'rgba(230,0,0,0.12)',
    },
    {
        id: 'AT-BigTime',
        label: 'AT BigTime',
        networks: ['AT-BigTime'],
        abbr: 'AT-BT',
        iconBg: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
        iconText: '#fff',
        blobColor: 'rgba(124,58,237,0.14)',
    },
]

const MAX_ORDERS = 500

export default function DataPackagesPage() {
    const { dbUser, session } = useAuth()

    const [packages, setPackages] = useState<DataPackage[]>([])
    // Per-user custom price overrides: packageId -> custom_price
    const [priceOverrides, setPriceOverrides] = useState<Map<string, number>>(new Map())
    const [selectedGroup, setSelectedGroup] = useState<NetworkGroupId>('MTN')
    const [walletBalance, setWalletBalance] = useState(0)
    const [creditLimit, setCreditLimit] = useState(0)
    const [unlimitedCredit, setUnlimitedCredit] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const [isSuggestOpen, setIsSuggestOpen] = useState(false)
    const [suggestNetwork, setSuggestNetwork] = useState<NetworkGroupId>('MTN')

    const [inputMode, setInputMode] = useState<InputMode>('text')
    const [bulkText, setBulkText] = useState('')
    const [excelFile, setExcelFile] = useState<File | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
    const [isPreviewing, setIsPreviewing] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => { fetchPackages() }, [])
    useEffect(() => {
        if (dbUser) {
            fetchWalletBalance()
            fetchPriceOverrides()
        }
    }, [dbUser])

    // Clear results whenever input changes to prevent stale submissions
    useEffect(() => { setValidationResults([]) }, [selectedGroup, bulkText, excelFile, inputMode])

    const fetchPackages = async () => {
        try {
            const { data, error } = await supabase
                .from('data_packages')
                // Explicit columns — cost_price (admin margin) is intentionally excluded
                .select('id, network, size, price, dealer_price, agent_price, is_available, sort_order, description, created_at')
                .eq('is_available', true)
                .order('sort_order', { ascending: true })
            if (error) throw error
            setPackages(data || [])
        } catch {
            toast.error('Failed to load packages')
        } finally {
            setIsLoading(false)
        }
    }

    const fetchWalletBalance = async () => {
        if (!dbUser) return
        const { data } = await supabase
            .from('wallets')
            .select('balance, credit_limit, unlimited_credit')
            .eq('user_id', dbUser.id)
            .single()
        if (data) {
            setWalletBalance((data as any).balance || 0)
            setCreditLimit((data as any).credit_limit || 0)
            setUnlimitedCredit(!!(data as any).unlimited_credit)
        }
    }

    // Load this user's custom price overrides (RLS restricts to own rows)
    const fetchPriceOverrides = async () => {
        if (!dbUser) return
        const { data } = await (supabase
            .from('user_package_pricing') as any)
            .select('package_id, custom_price')
            .eq('user_id', dbUser.id)
        const map = new Map<string, number>()
        for (const row of (data || [])) {
            map.set(row.package_id, Number(row.custom_price))
        }
        setPriceOverrides(map)
    }

    const getEffectivePrice = (pkg: DataPackage) => {
        const role = dbUser?.role || 'agent'
        return resolvePackagePrice(pkg, role, priceOverrides)
    }

    const getGroupInfo = (groupId: NetworkGroupId) => {
        const group = NETWORK_GROUPS.find(g => g.id === groupId)!
        const count = packages.filter(p => group.networks.includes(p.network)).length
        return { isLive: count > 0 }
    }

    // ─── Parsing ───────────────────────────────────────────────────────────────

    const parseTextInput = (text: string): { lineNumber: number; phoneNumber: string; volume: number }[] =>
        text.trim().split('\n')
            .map((line, index) => {
                const trimmed = line.trim()
                if (!trimmed) return null
                const parts = trimmed.split(/\s+/)
                if (parts.length < 2) return null
                const phone = parts[0].trim()
                const volStr = parts[1].toLowerCase().replace(/gb/g, '').replace(/g$/g, '').trim()
                const volume = parseFloat(volStr)
                if (isNaN(volume)) return null
                return { lineNumber: index + 1, phoneNumber: phone, volume }
            })
            .filter(Boolean) as { lineNumber: number; phoneNumber: string; volume: number }[]

    const parseExcelFile = (file: File): Promise<{ lineNumber: number; phoneNumber: string; volume: number }[]> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = async e => {
                try {
                    // Lazy-load xlsx (~hundreds of KB) only when an Excel file is actually parsed,
                    // so it never bloats the initial page load.
                    const XLSX = await import('xlsx')
                    const workbook = XLSX.read(e.target?.result, { type: 'binary' })
                    const sheet = workbook.Sheets[workbook.SheetNames[0]]
                    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
                    const parsed = rows
                        .map((row, i) => {
                            if (i === 0) {
                                const first = row[0]?.toString().toLowerCase()
                                if (first?.includes('phone') || first?.includes('number')) return null
                            }
                            const phone = row[0]?.toString().trim()
                            const volStr = row[1]?.toString().replace(/gb/gi, '').trim()
                            const volume = parseFloat(volStr)
                            if (!phone || isNaN(volume)) return null
                            return { lineNumber: i + 1, phoneNumber: phone, volume }
                        })
                        .filter(Boolean) as { lineNumber: number; phoneNumber: string; volume: number }[]
                    resolve(parsed)
                } catch (err) {
                    reject(err)
                }
            }
            reader.onerror = reject
            reader.readAsBinaryString(file)
        })

    // ─── Validation ────────────────────────────────────────────────────────────

    const validateEntries = (entries: { lineNumber: number; phoneNumber: string; volume: number }[]): ValidationResult[] => {
        const group = NETWORK_GROUPS.find(g => g.id === selectedGroup)!
        const groupNetworks = group.networks
        const targetNet = selectedGroup === 'AT-BigTime'
            ? 'AirtelTigo'
            : selectedGroup

        return entries.map(entry => {
            const phoneVal = validateGhanaianPhone(entry.phoneNumber)
            if (!phoneVal.isValid) {
                return { ...entry, packagePrice: 0, isValid: false, errorMessage: 'Invalid phone number' }
            }

            const detected = detectNetwork(entry.phoneNumber)
            if (detected !== targetNet) {
                return { ...entry, phoneNumber: phoneVal.normalizedNumber, packagePrice: 0, isValid: false, errorMessage: `Wrong network (${detected})` }
            }

            const pkg = packages.find(p => {
                if (!groupNetworks.includes(p.network)) return false
                const lower = p.size.toLowerCase()
                if (lower.includes('gb')) return parseFloat(lower.replace('gb', '').trim()) === entry.volume
                if (lower.includes('mb')) return parseFloat(lower.replace('mb', '').trim()) / 1000 === entry.volume
                return false
            })

            if (!pkg) {
                return { ...entry, phoneNumber: phoneVal.normalizedNumber, packagePrice: 0, isValid: false, errorMessage: `No ${entry.volume} GB package for ${selectedGroup}` }
            }

            return {
                ...entry,
                phoneNumber: phoneVal.normalizedNumber,
                packagePrice: getEffectivePrice(pkg),
                packageId: pkg.id,
                isValid: true,
            }
        })
    }

    // ─── Preview ───────────────────────────────────────────────────────────────

    const handlePreview = async () => {
        setIsPreviewing(true)
        try {
            let entries: { lineNumber: number; phoneNumber: string; volume: number }[] = []

            if (inputMode === 'text') {
                if (!bulkText.trim()) { toast.error('Enter at least one order'); return }
                entries = parseTextInput(bulkText)
            } else {
                if (!excelFile) { toast.error('Upload a file first'); return }
                entries = await parseExcelFile(excelFile)
            }

            if (entries.length === 0) { toast.error('No readable entries found'); return }
            if (entries.length > MAX_ORDERS) {
                toast.error(`Maximum ${MAX_ORDERS} orders per batch`)
                return
            }

            const results = validateEntries(entries)
            setValidationResults(results)

            const valid = results.filter(r => r.isValid).length
            if (valid > 0) toast.success(`${valid} valid order${valid !== 1 ? 's' : ''} ready`)
            else toast.error('No valid orders found — check phone numbers and package sizes')
        } catch {
            toast.error('Failed to process entries')
        } finally {
            setIsPreviewing(false)
        }
    }

    // ─── Place order ───────────────────────────────────────────────────────────

    const handlePlaceOrder = async () => {
        const validOrders = validationResults.filter(r => r.isValid)
        if (validOrders.length === 0) return

        const totalCost = validOrders.reduce((s, r) => s + r.packagePrice, 0)
        if (!unlimitedCredit && walletBalance + creditLimit < totalCost) {
            toast.error(`Insufficient balance. Need ${formatCurrency(totalCost)}`)
            return
        }

        setIsSubmitting(true)
        try {
            const ordersPayload = validOrders.map(order => ({
                packageId: order.packageId,
                phoneNumber: order.phoneNumber,
                idempotencyKey: crypto.randomUUID(),
            }))

            const response = await fetch('/api/orders/create-bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ orders: ordersPayload }),
            })

            const data = await response.json()

            if (data.summary?.succeeded > 0) {
                toast.success(`${data.summary.succeeded} order${data.summary.succeeded !== 1 ? 's' : ''} placed!`)
                if (data.newBalance !== undefined) setWalletBalance(data.newBalance)
                else fetchWalletBalance()
                setBulkText('')
                setExcelFile(null)
                setValidationResults([])
                if (fileInputRef.current) fileInputRef.current.value = ''
            }
            if (data.summary?.failed > 0) toast.error(`${data.summary.failed} order${data.summary.failed !== 1 ? 's' : ''} failed`)
            if (!response.ok && !data.summary) toast.error(data.error || 'Failed to place orders')
        } catch {
            toast.error('Error placing orders')
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    const deleteInvalidResult = (lineNumber: number) => {
        setValidationResults(prev => prev.filter(r => r.lineNumber !== lineNumber))
    }

    const clearAllInvalid = () => {
        setValidationResults(prev => prev.filter(r => r.isValid))
    }

    const downloadTemplate = () => {
        const csv = 'Phone Number,Data GB\n0241234567,5\n0541234567,10\n0207654321,1\n'
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'bulk-orders-template.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    const validCount = validationResults.filter(r => r.isValid).length
    const invalidCount = validationResults.filter(r => !r.isValid).length
    const totalCost = validationResults.filter(r => r.isValid).reduce((s, r) => s + r.packagePrice, 0)
    const balanceAfter = walletBalance - totalCost
    const hasResults = validationResults.length > 0

    // ─── Loading ───────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        )
    }

    // ─── Render ────────────────────────────────────────────────────────────────

    return (
        <>
        <div className="max-w-2xl mx-auto space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Data Bundles</h1>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSuggestOpen(true)}
                        className="rounded-xl text-sm font-semibold border-border gap-1.5"
                    >
                        <Tag className="w-3.5 h-3.5" />
                        View Prices
                    </Button>
                    <Button size="sm" className="rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 border-0">
                        Place new
                    </Button>
                </div>
            </div>

            {/* Network cards — 2 col on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {NETWORK_GROUPS.map(group => {
                    const { isLive } = getGroupInfo(group.id)
                    const isSelected = selectedGroup === group.id

                    return (
                        <button
                            key={group.id}
                            onClick={() => setSelectedGroup(group.id)}
                            className={cn(
                                'relative rounded-2xl border-2 p-4 text-left transition-all duration-200 bg-card hover:shadow-md w-full',
                                isSelected ? 'border-emerald-400 shadow-md' : 'border-border hover:border-muted-foreground/30'
                            )}
                        >
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center shadow-sm z-10">
                                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                </div>
                            )}
                            {!isSelected && (
                                <div
                                    className="absolute top-2 right-2 w-14 h-14 rounded-full blur-xl pointer-events-none"
                                    style={{ background: group.blobColor }}
                                />
                            )}

                            {/* Icon */}
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black mb-3 shadow-sm shrink-0"
                                style={{ background: group.iconBg, color: group.iconText }}
                            >
                                {group.abbr}
                            </div>

                            {/* Name */}
                            <p className="font-bold text-xs text-foreground mb-2 leading-tight">{group.label}</p>

                            {/* Status only — no GB range */}
                            {isLive ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                    Live
                                </span>
                            ) : (
                                <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    Inactive
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {/* Add items card */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-foreground">Add items</h2>
                    {/* Mode toggle */}
                    <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                        <button
                            onClick={() => setInputMode('text')}
                            className={cn(
                                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors',
                                inputMode === 'text'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <FileText className="w-3 h-3" />
                            Text
                        </button>
                        <button
                            onClick={() => setInputMode('excel')}
                            className={cn(
                                'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors',
                                inputMode === 'excel'
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            <FileSpreadsheet className="w-3 h-3" />
                            Excel / CSV
                        </button>
                    </div>
                </div>

                {inputMode === 'text' ? (
                    <>
                        <p className="text-xs text-muted-foreground">
                            One per line · up to {MAX_ORDERS} items · e.g.{' '}
                            <span className="font-mono text-foreground">0241234567 5</span>{' '}
                            or{' '}
                            <span className="font-mono text-foreground">0551234567 10</span>
                        </p>
                        <textarea
                            className="w-full min-h-[200px] resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-colors"
                            placeholder={"0241234567 5\n0541234567 10\n0207654321 1"}
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            spellCheck={false}
                        />
                    </>
                ) : (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                                Upload an Excel or CSV file · up to {MAX_ORDERS} rows
                            </p>
                            <button
                                onClick={downloadTemplate}
                                className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                            >
                                <Download className="w-3 h-3" />
                                Download template
                            </button>
                        </div>
                        <div
                            className={cn(
                                'relative rounded-xl border-2 border-dashed transition-colors cursor-pointer',
                                excelFile ? 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-border hover:border-muted-foreground/50 bg-muted/30'
                            )}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls,.csv"
                                className="hidden"
                                onChange={e => {
                                    const file = e.target.files?.[0]
                                    if (file) setExcelFile(file)
                                }}
                            />
                            <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                                <div className="w-10 h-10 rounded-xl bg-background border border-border flex items-center justify-center shadow-sm">
                                    <Upload className={cn('w-4 h-4', excelFile ? 'text-emerald-500' : 'text-muted-foreground')} />
                                </div>
                                <p className="text-sm font-semibold text-foreground">
                                    {excelFile ? excelFile.name : 'Click to upload file'}
                                </p>
                                <p className="text-xs text-muted-foreground">.xlsx · .xls · .csv</p>
                            </div>
                        </div>
                        {/* Template format hint */}
                        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                            <p className="font-semibold text-foreground mb-1.5">Template format</p>
                            <div className="font-mono space-y-0.5">
                                <p><span className="text-foreground font-semibold">Phone Number</span> · <span className="text-foreground font-semibold">Data GB</span></p>
                                <p>0241234567 · 5</p>
                                <p>0541234567 · 10</p>
                                <p>0207654321 · 1</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview results — summary layout */}
            {hasResults && (
                <div className="space-y-3">

                    {/* Valid summary */}
                    {validCount > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1">
                                        {validCount} valid order{validCount !== 1 ? 's' : ''}
                                    </p>
                                    <p className="text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                                        {formatCurrency(totalCost)}
                                    </p>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-500 uppercase tracking-widest mb-1">
                                        Balance after
                                    </p>
                                    <p className={cn(
                                        'text-base font-semibold',
                                        balanceAfter < 0
                                            ? 'text-red-500'
                                            : 'text-emerald-700 dark:text-emerald-300'
                                    )}>
                                        {formatCurrency(balanceAfter)}
                                    </p>
                                    <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 mt-0.5">
                                        from {formatCurrency(walletBalance)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Invalid summary — collapsible list */}
                    {invalidCount > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3">
                                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-widest">
                                    {invalidCount} invalid order{invalidCount !== 1 ? 's' : ''}
                                </p>
                                <button
                                    onClick={clearAllInvalid}
                                    className="text-xs font-semibold text-amber-600 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                                >
                                    Remove all
                                </button>
                            </div>
                            <div className="border-t border-amber-200 dark:border-amber-800 max-h-52 overflow-y-auto divide-y divide-amber-100 dark:divide-amber-900/50">
                                {validationResults
                                    .filter(r => !r.isValid)
                                    .map(res => (
                                        <div key={res.lineNumber} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                                            <span className="font-mono font-medium text-amber-800 dark:text-amber-300 w-28 shrink-0">
                                                {res.phoneNumber}
                                            </span>
                                            <span className="flex-1 text-amber-600 dark:text-amber-500 truncate">
                                                {res.errorMessage}
                                            </span>
                                            <button
                                                onClick={() => deleteInvalidResult(res.lineNumber)}
                                                className="shrink-0 p-1 rounded-md hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                                            >
                                                <X className="w-3.5 h-3.5 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300" />
                                            </button>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Action bar */}
            <div className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center gap-3">
                <div className="flex-1 text-sm text-muted-foreground min-w-0">
                    <span className="font-semibold text-foreground">{validCount} valid rows</span>
                    {' · '}Wallet{' '}
                    <span className="font-semibold text-foreground">{formatCurrency(walletBalance)}</span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={isPreviewing || (inputMode === 'text' ? !bulkText.trim() : !excelFile)}
                    className="rounded-xl font-semibold shrink-0"
                >
                    {isPreviewing && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Preview price
                </Button>
                <Button
                    size="sm"
                    onClick={handlePlaceOrder}
                    disabled={isSubmitting || validCount === 0}
                    className="rounded-xl font-semibold bg-emerald-500 hover:bg-emerald-600 text-white border-0 shrink-0"
                >
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Place order
                </Button>
            </div>

        </div>

        {/* Suggest / Package price list modal */}
        <Dialog open={isSuggestOpen} onOpenChange={setIsSuggestOpen}>
            <DialogContent className="max-w-sm w-[calc(100vw-2rem)] rounded-2xl p-0 overflow-hidden gap-0">
                <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                    <DialogTitle className="text-base font-semibold text-foreground">Package Prices</DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Viewing as{' '}
                        <span className="font-semibold text-foreground capitalize">{dbUser?.role || 'agent'}</span>
                    </p>
                </DialogHeader>

                {/* Network tabs */}
                <div className="px-4 pt-4 pb-2 flex gap-2 flex-wrap">
                    {NETWORK_GROUPS.map(group => {
                        const isActive = suggestNetwork === group.id
                        return (
                            <button
                                key={group.id}
                                onClick={() => setSuggestNetwork(group.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border',
                                    isActive
                                        ? 'border-transparent text-white shadow-sm'
                                        : 'border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted'
                                )}
                                style={isActive ? { background: group.iconBg } : {}}
                            >
                                <span
                                    className="w-4 h-4 rounded-md flex items-center justify-center text-[8px] font-black shrink-0"
                                    style={isActive
                                        ? { background: 'rgba(255,255,255,0.22)', color: '#fff' }
                                        : { background: group.iconBg, color: group.iconText }}
                                >
                                    {group.abbr.charAt(0)}
                                </span>
                                {group.label}
                            </button>
                        )
                    })}
                </div>

                {/* Package list */}
                <div className="px-4 pb-5 pt-1 max-h-72 overflow-y-auto space-y-2">
                    {(() => {
                        const group = NETWORK_GROUPS.find(g => g.id === suggestNetwork)!
                        const filtered = packages.filter(p => group.networks.includes(p.network))

                        if (filtered.length === 0) {
                            return (
                                <div className="text-center py-10 text-muted-foreground text-sm">
                                    No packages available for {group.label}
                                </div>
                            )
                        }

                        return filtered.map(pkg => (
                            <div
                                key={pkg.id}
                                className="flex items-center justify-between px-4 py-3 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors"
                            >
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{pkg.size}</p>
                                    {pkg.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{pkg.description}</p>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-foreground shrink-0 ml-4">
                                    {formatCurrency(getEffectivePrice(pkg))}
                                </p>
                            </div>
                        ))
                    })()}
                </div>
            </DialogContent>
        </Dialog>
        </>
    )
}
