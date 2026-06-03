'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { formatCurrency, cn } from '@/lib/utils'
import { validateGhanaianPhone, detectNetwork } from '@/lib/phone-validation'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { DataPackage } from '@/types/supabase'

interface ValidationResult {
    lineNumber: number
    phoneNumber: string
    volume: number
    packagePrice: number
    isValid: boolean
    errorMessage?: string
    successMessage?: string
    packageId?: string
}

interface NetworkGroup {
    id: 'MTN' | 'AirtelTigo' | 'Telecel'
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
        id: 'AirtelTigo',
        label: 'AirtelTigo',
        networks: ['AT-iShare', 'AT-BigTime'],
        abbr: 'AT',
        iconBg: 'linear-gradient(135deg,#7C3AED,#A78BFA)',
        iconText: '#fff',
        blobColor: 'rgba(124,58,237,0.14)',
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
]

function parseSizeToGB(size: string): number {
    const lower = size.toLowerCase()
    if (lower.includes('mb')) return parseFloat(lower) / 1000
    return parseFloat(lower)
}

export default function DataPackagesPage() {
    const { dbUser, session } = useAuth()

    const [packages, setPackages] = useState<DataPackage[]>([])
    const [selectedGroup, setSelectedGroup] = useState<'MTN' | 'AirtelTigo' | 'Telecel'>('MTN')
    const [walletBalance, setWalletBalance] = useState(0)
    const [creditLimit, setCreditLimit] = useState(0)
    const [unlimitedCredit, setUnlimitedCredit] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [bulkText, setBulkText] = useState('')
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
    const [isPreviewing, setIsPreviewing] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        fetchPackages()
    }, [])

    useEffect(() => {
        if (dbUser) fetchWalletBalance()
    }, [dbUser])

    // Clear results when network or text changes so stale data isn't submitted
    useEffect(() => {
        setValidationResults([])
    }, [selectedGroup, bulkText])

    const fetchPackages = async () => {
        try {
            const { data, error } = await supabase
                .from('data_packages')
                .select('*')
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

    const getEffectivePrice = (pkg: DataPackage) => {
        const role = dbUser?.role || 'agent'
        if (role === 'dealer' && pkg.dealer_price && pkg.dealer_price > 0) return pkg.dealer_price
        if (role === 'agent' && pkg.agent_price && pkg.agent_price > 0) return pkg.agent_price
        return pkg.price
    }

    const getGroupInfo = (groupId: string) => {
        const group = NETWORK_GROUPS.find(g => g.id === groupId)!
        const groupPkgs = packages.filter(p => group.networks.includes(p.network))
        const count = groupPkgs.length
        if (count === 0) return { isLive: false, range: '' }
        const sizes = groupPkgs.map(p => parseSizeToGB(p.size)).filter(n => !isNaN(n))
        const min = Math.min(...sizes)
        const max = Math.max(...sizes)
        const range = min === max ? `${min} GB` : `${min}–${max} GB`
        return { isLive: true, range }
    }

    const handlePreview = () => {
        if (!bulkText.trim()) {
            toast.error('Enter at least one order')
            return
        }
        setIsPreviewing(true)

        const group = NETWORK_GROUPS.find(g => g.id === selectedGroup)!
        const groupNetworks = group.networks
        const targetNet = selectedGroup === 'AirtelTigo' ? 'AirtelTigo' : selectedGroup

        const lines = bulkText.trim().split('\n')
        const results: ValidationResult[] = lines
            .map((line, index) => {
                const trimmed = line.trim()
                if (!trimmed) return null
                const parts = trimmed.split(/\s+/)
                if (parts.length < 2) return null
                const rawPhone = parts[0].trim()
                const volStr = parts[1].toLowerCase().replace('gb', '').replace('g', '').trim()
                const volume = parseFloat(volStr)
                if (isNaN(volume)) return null

                const phoneValidation = validateGhanaianPhone(rawPhone)
                if (!phoneValidation.isValid) {
                    return { lineNumber: index + 1, phoneNumber: rawPhone, volume, packagePrice: 0, isValid: false, errorMessage: 'Invalid phone number' }
                }

                const detected = detectNetwork(rawPhone)
                if (detected !== targetNet) {
                    return { lineNumber: index + 1, phoneNumber: phoneValidation.normalizedNumber, volume, packagePrice: 0, isValid: false, errorMessage: `Wrong network (${detected})` }
                }

                const pkg = packages.find(p => {
                    if (!groupNetworks.includes(p.network)) return false
                    const lower = p.size.toLowerCase()
                    if (lower.includes('gb')) return parseFloat(lower.replace('gb', '').trim()) === volume
                    if (lower.includes('mb')) return parseFloat(lower.replace('mb', '').trim()) / 1000 === volume
                    return false
                })

                if (!pkg) {
                    return { lineNumber: index + 1, phoneNumber: phoneValidation.normalizedNumber, volume, packagePrice: 0, isValid: false, errorMessage: `No ${volume} GB package found` }
                }

                return {
                    lineNumber: index + 1,
                    phoneNumber: phoneValidation.normalizedNumber,
                    volume,
                    packagePrice: getEffectivePrice(pkg),
                    packageId: pkg.id,
                    isValid: true,
                    successMessage: pkg.size,
                }
            })
            .filter(Boolean) as ValidationResult[]

        setValidationResults(results)
        setIsPreviewing(false)

        const valid = results.filter(r => r.isValid).length
        if (valid > 0) toast.success(`${valid} valid order${valid !== 1 ? 's' : ''} ready`)
        else toast.error('No valid orders found')
    }

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
                setValidationResults([])
            }
            if (data.summary?.failed > 0) toast.error(`${data.summary.failed} order${data.summary.failed !== 1 ? 's' : ''} failed`)
            if (!response.ok && !data.summary) toast.error(data.error || 'Failed to place orders')
        } catch {
            toast.error('Error placing orders')
        } finally {
            setIsSubmitting(false)
        }
    }

    const validCount = validationResults.filter(r => r.isValid).length
    const totalCost = validationResults.filter(r => r.isValid).reduce((s, r) => s + r.packagePrice, 0)
    const hasResults = validationResults.length > 0

    if (isLoading) {
        return (
            <div className="max-w-2xl mx-auto space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-3 gap-3">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                </div>
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">Data Bundles</h1>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/my-orders">
                        <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-sm font-semibold border-border"
                        >
                            My bundles
                        </Button>
                    </Link>
                    <Button
                        size="sm"
                        className="rounded-xl text-sm font-semibold bg-foreground text-background hover:bg-foreground/90 border-0"
                    >
                        Place new
                    </Button>
                </div>
            </div>

            {/* Network selection cards */}
            <div className="grid grid-cols-3 gap-3">
                {NETWORK_GROUPS.map(group => {
                    const { isLive, range } = getGroupInfo(group.id)
                    const isSelected = selectedGroup === group.id

                    return (
                        <button
                            key={group.id}
                            onClick={() => setSelectedGroup(group.id)}
                            className={cn(
                                'relative rounded-2xl border-2 p-4 text-left transition-all duration-200 bg-card hover:shadow-md w-full',
                                isSelected
                                    ? 'border-emerald-400 shadow-md'
                                    : 'border-border hover:border-muted-foreground/30'
                            )}
                        >
                            {/* Checkmark (selected) */}
                            {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-emerald-400 flex items-center justify-center shadow-sm z-10">
                                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                </div>
                            )}

                            {/* Decorative blob (unselected) */}
                            {!isSelected && (
                                <div
                                    className="absolute top-2 right-2 w-14 h-14 rounded-full blur-xl pointer-events-none"
                                    style={{ background: group.blobColor }}
                                />
                            )}

                            {/* Network icon */}
                            <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center text-[11px] font-black mb-3 shadow-sm shrink-0"
                                style={{ background: group.iconBg, color: group.iconText }}
                            >
                                {group.abbr}
                            </div>

                            {/* Name */}
                            <p className="font-bold text-sm text-foreground mb-2 truncate">{group.label}</p>

                            {/* Status + range */}
                            <div className="flex flex-col gap-1">
                                {isLive ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full w-fit">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                        Live
                                    </span>
                                ) : (
                                    <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full w-fit">
                                        Inactive
                                    </span>
                                )}
                                {range && (
                                    <span className="text-[10px] text-muted-foreground font-medium">{range}</span>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>

            {/* Add items */}
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                <h2 className="font-bold text-foreground">Add items</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                    One per line:
                    <code className="bg-muted text-foreground px-1.5 py-0.5 rounded text-[11px] font-mono">phone</code>
                    <code className="bg-muted text-foreground px-1.5 py-0.5 rounded text-[11px] font-mono">data_gb</code>
                    · up to 1,000 items.
                </p>
                <textarea
                    className="w-full min-h-[200px] resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400 transition-colors"
                    placeholder={"0241234567 5\n0541234567 10\n0207654321 1"}
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    spellCheck={false}
                />
            </div>

            {/* Validation results */}
            {hasResults && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                        <span className="text-sm font-semibold text-foreground">
                            {validCount} valid
                            {validationResults.length - validCount > 0 && (
                                <span className="text-muted-foreground font-normal">
                                    {' · '}{validationResults.length - validCount} invalid
                                </span>
                            )}
                        </span>
                        <button
                            onClick={() => setValidationResults([])}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                        >
                            <X className="w-3 h-3" />
                            Clear
                        </button>
                    </div>

                    <div className="max-h-72 overflow-y-auto divide-y divide-border">
                        {validationResults.map((res, i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-2.5 text-xs">
                                <div className={cn(
                                    'w-1.5 h-1.5 rounded-full shrink-0',
                                    res.isValid ? 'bg-emerald-500' : 'bg-red-500'
                                )} />
                                <span className="font-mono font-medium text-foreground w-28 shrink-0">{res.phoneNumber}</span>
                                <span className="text-muted-foreground w-14 shrink-0">{res.volume} GB</span>
                                <span className={cn(
                                    'flex-1 truncate',
                                    res.isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                                )}>
                                    {res.isValid ? res.successMessage : res.errorMessage}
                                </span>
                                <span className="font-semibold text-foreground ml-auto shrink-0">
                                    {res.isValid ? formatCurrency(res.packagePrice) : '—'}
                                </span>
                            </div>
                        ))}
                    </div>

                    {validCount > 0 && (
                        <div className="px-5 py-3 border-t border-border bg-muted/30 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground text-xs">{validCount} order{validCount !== 1 ? 's' : ''}</span>
                            <span className="font-bold text-foreground">{formatCurrency(totalCost)}</span>
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
                    disabled={isPreviewing || !bulkText.trim()}
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
    )
}
