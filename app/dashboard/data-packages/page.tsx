'use client'

import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { formatCurrency, getNetworkGradient, cn } from '@/lib/utils'
import { validateGhanaianPhone, detectNetwork } from '@/lib/phone-validation'
import { NetworkIcon } from '@/components/network-icon'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Search,
    LayoutGrid,
    List,
    Wifi,
    Loader2,
    CheckCircle2,
    Check,
    AlertCircle,
    ShoppingCart,
    Plus,
    DollarSign,
    X,
    FileSpreadsheet,
    FileText,
    CloudUpload
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { DataPackage } from '@/types/supabase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trash2, Upload } from 'lucide-react'
import { useTutorial } from '@/hooks/useTutorial'
import { HelpButton } from '@/components/tutorial/HelpButton'

interface ValidationResult {
    lineNumber: number
    phoneNumber: string
    volume: number
    packagePrice: number
    isValid: boolean
    errorMessage?: string
    successMessage?: string
    packageId?: string
    packageName?: string
}


const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'] as const

export default function DataPackagesPage() {
    const { dbUser, session } = useAuth()
    const router = useRouter()

    // Tutorial hook
    const userRole = ['agent', 'dealer'].includes(dbUser?.role || '') ? 'agent' : 'user'
    const { startTutorial } = useTutorial(userRole as 'user' | 'agent', '/data-packages')
    // Joseph: all special roles use agent tutorial

    const [packages, setPackages] = useState<DataPackage[]>([])
    const [filteredPackages, setFilteredPackages] = useState<DataPackage[]>([])
    const [selectedNetwork, setSelectedNetwork] = useState<string>('MTN')
    const [searchQuery, setSearchQuery] = useState('')
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
    const [isLoading, setIsLoading] = useState(true)
    const [walletBalance, setWalletBalance] = useState(0)
    const [creditLimit, setCreditLimit] = useState(0)
    const [unlimitedCredit, setUnlimitedCredit] = useState(false)

    const [ordersToday, setOrdersToday] = useState(0)

    // Purchase dialog state
    const [selectedPackage, setSelectedPackage] = useState<DataPackage | null>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [phoneError, setPhoneError] = useState('')
    const [isPurchasing, setIsPurchasing] = useState(false)
    const [purchaseSuccess, setPurchaseSuccess] = useState(false)
    const [idempotencyKey, setIdempotencyKey] = useState('')

    // Bulk Order State
    const [bulkInputType, setBulkInputType] = useState<'text' | 'excel' | null>(null)
    const [bulkText, setBulkText] = useState('')
    const [bulkNetwork, setBulkNetwork] = useState<string>('')
    const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
    const [isValidating, setIsValidating] = useState(false)
    const [isSubmittingBulk, setIsSubmittingBulk] = useState(false)
    const [bulkFile, setBulkFile] = useState<File | null>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    const totalBulkData = validationResults.reduce((sum, r) => sum + (r.isValid ? r.volume : 0), 0)
    const totalBulkCost = validationResults.reduce((sum, r) => sum + (r.isValid ? r.packagePrice : 0), 0)


    useEffect(() => {
        fetchPackages()
        fetchWalletBalance()
        fetchOrdersToday()
    }, [dbUser])

    useEffect(() => {
        filterPackages()
    }, [packages, selectedNetwork, searchQuery])


    const fetchPackages = async () => {
        try {
            const { data, error } = await supabase
                .from('data_packages')
                .select('*')
                .eq('is_available', true)
                .order('sort_order', { ascending: true })

            if (error) throw error
            setPackages(data || [])
        } catch (error) {
            console.error('Error fetching packages:', error)
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

    const fetchOrdersToday = async () => {
        if (!dbUser) return

        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const { count, error } = await supabase
            .from('orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', dbUser.id)
            .gte('created_at', today.toISOString())
            .neq('status', 'failed')

        if (!error) {
            setOrdersToday(count || 0)
        }
    }

    const filterPackages = () => {
        let filtered = packages

        // Filter by network
        filtered = filtered.filter(p => p.network === selectedNetwork)

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(p =>
                p.size.toLowerCase().includes(query) ||
                p.network.toLowerCase().includes(query) ||
                p.description?.toLowerCase().includes(query)
            )
        }

        setFilteredPackages(filtered)
    }

    // Returns the price appropriate for the user's role
    const getEffectivePrice = (pkg: DataPackage) => {
        const role = dbUser?.role || 'agent'
        if (role === 'dealer' && pkg.dealer_price && pkg.dealer_price > 0) return pkg.dealer_price
        if (role === 'agent' && pkg.agent_price && pkg.agent_price > 0) return pkg.agent_price
        return pkg.price
    }

    const handlePurchaseClick = (pkg: DataPackage) => {
        setSelectedPackage(pkg)
        setPhoneNumber('')
        setPhoneError('')
        setPurchaseSuccess(false)
        // Generate new idempotency key for this transaction attempt
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            setIdempotencyKey(crypto.randomUUID())
        } else {
            // Fallback for older browsers
            setIdempotencyKey(Math.random().toString(36).substring(2) + Date.now().toString(36))
        }
    }

    const handlePhoneChange = (value: string) => {
        setPhoneNumber(value)
        setPhoneError('')

        if (value.length >= 10) {
            const validation = validateGhanaianPhone(value)
            if (!validation.isValid) {
                setPhoneError(validation.error || 'Invalid phone number')
            } else if (selectedPackage) {
                // Check if network matches
                const detectedNet = detectNetwork(value)
                const packageNetwork = selectedPackage.network.includes('AT') ? 'AirtelTigo' : selectedPackage.network
                if (detectedNet !== packageNetwork && selectedPackage.network !== 'AT-BigTime') {
                    setPhoneError(`This number is for ${detectedNet}, not ${selectedPackage.network}`)
                }
            }
        }
    }

    const handlePurchase = async () => {
        if (!selectedPackage || !dbUser) return

        const validation = validateGhanaianPhone(phoneNumber)
        if (!validation.isValid) {
            setPhoneError(validation.error || 'Invalid phone number')
            return
        }

        const effectivePrice = getEffectivePrice(selectedPackage)
        const totalBuyingPower = walletBalance + creditLimit

        if (!unlimitedCredit && totalBuyingPower < effectivePrice) {
            setPhoneError('Insufficient balance (including credit limit)')
            return
        }

        setIsPurchasing(true)

        try {
            const response = await fetch('/api/orders/purchase', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({
                    packageId: selectedPackage.id,
                    phoneNumber: validation.normalizedNumber,
                    idempotencyKey,
                }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Purchase failed')
            }

            setPurchaseSuccess(true)
            setWalletBalance(prev => prev - effectivePrice)
            setOrdersToday(prev => prev + 1)
            toast.success('Order placed successfully!')
        } catch (error: any) {
            toast.error(error.message || 'Failed to place order')
        } finally {
            setIsPurchasing(false)
        }
    }

    // Bulk Order Functions
    const parseTextInput = (text: string) => {
        const lines = text.trim().split('\n')
        return lines
            .map((line, index) => {
                const trimmed = line.trim()
                if (!trimmed) return null

                // Split by spaces or tabs
                const parts = trimmed.split(/\s+/)
                if (parts.length < 2) return null

                // Assuming format: phone volume (e.g., "0551234567 1" or "241234567 5GB")
                const phone = parts[0].trim()
                
                // Clean volume string (handle 1GB, 1gb, 1, etc.)
                const volStr = parts[1].toLowerCase()
                    .replace('gb', '')
                    .replace('g', '')
                    .trim()
                const volume = parseFloat(volStr)

                if (isNaN(volume)) return null

                return {
                    lineNumber: index + 1,
                    phoneNumber: phone,
                    volume: volume,
                    rawLine: trimmed
                }
            })
            .filter(Boolean)
    }

    const validateLines = (parsedLines: any[]) => {
        if (!bulkNetwork) {
            toast.error('Please select a network first')
            return []
        }

        return parsedLines.map((line: any) => {
            // Validate phone
            const phoneValidation = validateGhanaianPhone(line.phoneNumber)
            if (!phoneValidation.isValid) {
                return {
                    ...line,
                    packagePrice: 0,
                    isValid: false,
                    errorMessage: 'Invalid phone number'
                }
            }

            // Check network match
            const detectedNet = detectNetwork(line.phoneNumber)
            const targetNet = bulkNetwork === 'AT-BigTime' || bulkNetwork === 'AT-iShare' ? 'AirtelTigo' : bulkNetwork
            if (detectedNet !== targetNet) {
                return {
                    ...line,
                    packagePrice: 0,
                    isValid: false,
                    errorMessage: `Wrong network (${detectedNet})`
                }
            }

            const pkg = packages.find(p => {
                if (p.network !== bulkNetwork) return false
                const pkgSize = p.size.toLowerCase()

                if (pkgSize.includes('gb')) {
                    const sizeVal = parseFloat(pkgSize.replace('gb', '').trim())
                    return sizeVal === line.volume
                } else if (pkgSize.includes('mb')) {
                    const sizeVal = parseFloat(pkgSize.replace('mb', '').trim())
                    return sizeVal / 1000 === line.volume
                }
                return false
            })

            if (!pkg) {
                return {
                    ...line,
                    packagePrice: 0,
                    isValid: false,
                    errorMessage: `No ${line.volume}GB package found`
                }
            }

            return {
                ...line,
                packagePrice: getEffectivePrice(pkg),
                packageId: pkg.id,
                packageName: pkg.network + ' ' + pkg.size,
                isValid: true,
                successMessage: `Package found (${pkg.size})`
            }
        })
    }

    const handleValidateBulk = async () => {
        if (!bulkNetwork) {
            toast.error('Please select a network first')
            return
        }
        if (!bulkText.trim()) {
            toast.error('Please enter phone numbers')
            return
        }

        setIsValidating(true)
        const parsedLines = parseTextInput(bulkText)
        const results = validateLines(parsedLines)

        setValidationResults(results)
        setIsValidating(false)
        if (results.length > 0) {
            toast.success(`Validated ${results.length} entries`)
        } else {
            toast.error('No valid lines found')
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setBulkFile(file)
            toast.success(`File ${file.name} selected`)
        }
    }

    const handleValidateExcel = async () => {
        if (!bulkNetwork) {
            toast.error('Please select a network first')
            return
        }
        if (!bulkFile) {
            toast.error('Please select an Excel file')
            return
        }

        setIsValidating(true)
        const reader = new FileReader()
        reader.onload = (e) => {
            const data = e.target?.result
            if (!data) {
                setIsValidating(false)
                return
            }

            try {
                const workbook = XLSX.read(data, { type: 'binary' })
                const sheetName = workbook.SheetNames[0]
                const worksheet = workbook.Sheets[sheetName]
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

                // Assuming columns: Phone, Volume
                const parsedLines = jsonData.map((row, index) => {
                    if (index === 0 && (row[0]?.toString().toLowerCase().includes('phone') || row[0]?.toString().length > 10)) {
                        // Skip header if it looks like one
                        if (row[0]?.toString().toLowerCase().includes('phone')) return null
                    }

                    const phone = row[0]?.toString().trim()
                    const volumeStr = row[1]?.toString().toLowerCase().replace('gb', '').trim()
                    const volume = parseFloat(volumeStr)

                    if (!phone || isNaN(volume)) return null

                    return {
                        lineNumber: index + 1,
                        phoneNumber: phone,
                        volume: volume,
                        rawLine: row.join(' ')
                    }
                }).filter(Boolean)

                const results = validateLines(parsedLines)
                setValidationResults(results)
                toast.success(`Validated ${results.length} entries from Excel`)
            } catch (error) {
                toast.error('Error parsing Excel file')
            } finally {
                setIsValidating(false)
            }
        }
        reader.readAsBinaryString(bulkFile)
    }

    const clearInvalid = () => {
        setValidationResults(prev => prev.filter(r => r.isValid))
    }

    const clearAllResults = () => {
        setValidationResults([])
        setBulkText('')
        setBulkFile(null)
    }

    const deleteResult = (index: number) => {
        setValidationResults(prev => prev.filter((_, i) => i !== index))
    }

    const handleSubmitBulkOrder = async () => {
        const validOrders = validationResults.filter(r => r.isValid)
        if (validOrders.length === 0) return

        const totalCost = validOrders.reduce((sum, order) => sum + order.packagePrice, 0)
        const totalBuyingPower = walletBalance + creditLimit

        if (!unlimitedCredit && totalBuyingPower < totalCost) {
            toast.error(`Insufficient balance. Need GHS ${formatCurrency(totalCost)} (including credit limit)`)
            return
        }

        setIsSubmittingBulk(true)

        try {
            // Generate idempotency key per order and send as single batch request
            const ordersPayload = validOrders.map(order => ({
                packageId: order.packageId,
                phoneNumber: validateGhanaianPhone(order.phoneNumber).normalizedNumber,
                idempotencyKey: typeof crypto !== 'undefined' && crypto.randomUUID
                    ? crypto.randomUUID()
                    : Math.random().toString(36).substring(2) + Date.now().toString(36) + Math.random().toString(36).substring(2),
            }))

            const response = await fetch('/api/orders/create-bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ orders: ordersPayload }),
            })

            const data = await response.json()

            if (data.summary) {
                if (data.summary.succeeded > 0) {
                    toast.success(`${data.summary.succeeded} orders placed successfully!`)
                    if (data.newBalance !== undefined) {
                        setWalletBalance(data.newBalance)
                    } else {
                        fetchWalletBalance()
                    }
                    fetchOrdersToday()
                    setValidationResults([])
                    setBulkText('')
                    setBulkFile(null)
                }
                if (data.summary.failed > 0) {
                    toast.error(`${data.summary.failed} orders failed`)
                }
            } else if (!response.ok) {
                toast.error(data.error || 'Failed to submit bulk orders')
            }

        } catch (error) {
            toast.error('Error submitting bulk orders')
        } finally {
            setIsSubmittingBulk(false)
        }
    }
    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-12 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...Array(8)].map((_, i) => (
                        <Skeleton key={i} className="h-48" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex-1 text-center">
                    <h1 className="text-2xl font-bold">Data Packages</h1>
                </div>
                <HelpButton onClick={startTutorial} />
            </div>

            <div className="flex flex-col items-center gap-4 text-center">

                {/* Stats Dashboard */}
                 <div id="stats-dashboard" className="grid grid-cols-2 gap-4 w-full max-w-md mx-auto mb-2 relative z-10">
                    <div className="glass-card rounded-[2rem] p-5 text-center flex flex-col items-center justify-between gap-4 relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 dark:bg-primary/20 rounded-full blur-3xl group-hover:bg-primary/20 dark:group-hover:bg-primary/30 transition-colors"></div>
                        <div className="relative z-10 w-full">
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-xs mb-1 uppercase tracking-widest">
                                Wallet Balance
                            </p>
                            <p className="text-slate-900 dark:text-white text-2xl font-black tracking-tight leading-none drop-shadow-sm dark:drop-shadow-md">
                                {formatCurrency(walletBalance)}
                            </p>
                        </div>
                        <Button
                            size="sm"
                            className="h-9 w-full rounded-xl text-xs uppercase font-black tracking-widest gradient-primary text-white hover:glow-primary hover:-translate-y-0.5 transition-all border-0 shadow-lg"
                            onClick={() => router.push('/dashboard/wallet')}
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Top Up
                        </Button>
                    </div>

                    <div className="glass-card rounded-[2rem] p-5 text-center flex flex-col items-center justify-center relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
                        <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/10 dark:group-hover:bg-cyan-500/20 transition-colors"></div>
                        <div className="relative z-10 w-full">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-[0_0_15px_rgba(34,211,238,0.3)] flex items-center justify-center mx-auto mb-3">
                                <ShoppingCart className="w-5 h-5 text-white" />
                            </div>
                            <p className="text-slate-500 dark:text-slate-400 font-bold text-xs mb-1 uppercase tracking-widest">
                                Orders Today
                            </p>
                            <p className="text-slate-900 dark:text-white text-2xl font-black tracking-tight leading-none drop-shadow-sm dark:drop-shadow-md">
                                {ordersToday}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Bulk Order Section - Agents & Dealers */}
                {(['agent', 'dealer'].includes(dbUser?.role || '')) && (
                    <div id="bulk-order-section" className="w-full max-w-3xl mx-auto space-y-4 relative z-10">
                        {/* New Glow Header Box */}
                        <div className={cn(
                            "relative overflow-hidden group rounded-[2rem] p-6 shadow-xl transition-all duration-500",
                            dbUser?.role === 'dealer'
                                ? "bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-700 shadow-[0_0_40px_rgba(139,92,246,0.2)]"
                                : "bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600 shadow-[0_0_40px_rgba(245,158,11,0.2)]"
                        )}>
                            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-20 mix-blend-overlay"></div>
                            <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[200px] h-[200px] bg-white/30 rounded-full blur-[60px] opacity-40 group-hover:opacity-60 transition-opacity"></div>

                            <div className="flex items-start gap-4 relative z-10">
                                <div className="bg-white/90 dark:bg-black/80 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200/50 dark:border-white/10">
                                    <CloudUpload className="w-6 h-6 text-slate-900 dark:text-white group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <div className="flex-1 text-left">
                                    <h2 className="text-2xl font-black text-slate-900 dark:text-white leading-tight drop-shadow-sm">Bulk Orders Import</h2>
                                    <p className="text-sm font-bold text-slate-600 dark:text-white/80">Import multiple orders at once via Excel or Text</p>
                                </div>
                            </div>
                        </div>

                        {/* Toggles */}
                        <div className="flex gap-3 mt-6 relative z-10">
                            <Button
                                onClick={() => setBulkInputType(bulkInputType === 'text' ? null : 'text')}
                                className={cn(
                                    "flex-1 h-12 rounded-xl font-bold transition-all duration-300 border border-slate-200 dark:border-white/20",
                                    bulkInputType === 'text'
                                        ? (dbUser?.role === 'dealer' ? "bg-black text-purple-400 shadow-xl opacity-100 scale-[1.02]" : "bg-black text-yellow-500 dark:text-yellow-400 shadow-xl opacity-100 scale-[1.02]")
                                        : "bg-white/40 dark:bg-black/20 text-slate-600 dark:text-white hover:bg-white/60 dark:hover:bg-black/30 backdrop-blur-sm"
                                )}
                            >
                                <FileText className="w-4 h-4 mr-2" />
                                Text Input
                            </Button>
                            <Button
                                onClick={() => setBulkInputType(bulkInputType === 'excel' ? null : 'excel')}
                                className={cn(
                                    "flex-1 h-12 rounded-xl font-bold transition-all duration-300 border border-slate-200 dark:border-white/20",
                                    bulkInputType === 'excel'
                                        ? (dbUser?.role === 'dealer' ? "bg-black text-purple-400 shadow-xl opacity-100 scale-[1.02]" : "bg-black text-yellow-500 dark:text-yellow-400 shadow-xl opacity-100 scale-[1.02]")
                                        : "bg-white/40 dark:bg-black/20 text-slate-600 dark:text-white hover:bg-white/60 dark:hover:bg-black/30 backdrop-blur-sm"
                                )}
                            >
                                <FileSpreadsheet className="w-4 h-4 mr-2" />
                                Excel Import
                            </Button>
                        </div>

                        {/* Conditional Forms */}
                        {bulkInputType && (
                            <Card className="border-0 bg-transparent shadow-none animate-in fade-in slide-in-from-top-4 duration-500">
                                <CardContent className="p-0 space-y-4">
                                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-md lg:shadow-lg border border-gray-100 dark:border-zinc-800">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <Label className="text-[#E60000] font-black text-xs uppercase tracking-widest">Select Network</Label>
                                                <div className="flex gap-2 flex-wrap">
                                                    {NETWORKS.map(net => (
                                                        <Button
                                                            key={net}
                                                            variant={bulkNetwork === net ? "default" : "outline"}
                                                            className={cn(
                                                                "h-8 text-[10px] font-bold px-3 rounded-full transition-all",
                                                                bulkNetwork === net ?
                                                                    (net === 'MTN' ? 'bg-[#FFCC00] text-black hover:bg-[#FFCC00]/90 border-0' :
                                                                        net === 'Telecel' ? 'bg-[#E60000] text-white hover:bg-[#E60000]/90 border-0' :
                                                                            'bg-[#0056B3] text-white hover:bg-[#0056B3]/90 border-0')
                                                                    : 'bg-transparent border-gray-200 dark:border-zinc-700'
                                                            )}
                                                            onClick={() => setBulkNetwork(net)}
                                                            size="sm"
                                                        >
                                                            {net}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>

                                            {bulkInputType === 'text' ? (
                                                <div className="space-y-4">
                                                    <div className="text-center space-y-1 py-2">
                                                        <h3 className="text-lg font-black text-black dark:text-white">Enter Your Orders</h3>
                                                        <p className="text-xs font-bold text-gray-400">One order per line (e.g below)</p>
                                                    </div>

                                                    <div className="relative group">
                                                        <textarea
                                                            ref={textareaRef}
                                                            className={cn(
                                                                "w-full min-h-[160px] max-h-[400px] rounded-2xl border-2 border-gray-50 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50 px-4 py-4 text-[13px] leading-relaxed text-black dark:text-white placeholder:text-gray-300 dark:placeholder:text-zinc-600 focus:outline-none transition-colors font-mono font-bold overflow-y-auto",
                                                                dbUser?.role === 'dealer' ? "focus:border-purple-500" : "focus:border-[#FFCE00]"
                                                            )}
                                                            placeholder={`0246677889 2\n0546627266 3`}
                                                            value={bulkText}
                                                            onChange={(e) => setBulkText(e.target.value)}
                                                        />
                                                    </div>

                                                    <Button
                                                        className={cn(
                                                            "w-full font-black py-6 rounded-2xl shadow-lg text-sm transition-all",
                                                            dbUser?.role === 'dealer'
                                                                ? "bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-purple-600/20"
                                                                : "bg-[#FFCE00] hover:bg-[#FFCE00]/90 text-black shadow-[#FFCE00]/20"
                                                        )}
                                                        onClick={handleValidateBulk}
                                                        disabled={isValidating}
                                                    >
                                                        {isValidating ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                Validating...
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <Check className="w-4 h-4" />
                                                                Validate Orders
                                                            </div>
                                                        )}
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    <div className="text-center space-y-1 py-2">
                                                        <h3 className="text-lg font-black text-black dark:text-white">Excel Import</h3>
                                                        <p className="text-xs font-bold text-gray-400">Upload your sheet with Phone and Volume columns</p>
                                                    </div>

                                                    <div
                                                        className="border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-2xl p-8 text-center bg-gray-50/30 dark:bg-zinc-800/30 hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer relative"
                                                        onClick={() => document.getElementById('excel-upload')?.click()}
                                                    >
                                                        <input
                                                            id="excel-upload"
                                                            type="file"
                                                            accept=".xlsx, .xls, .csv"
                                                            className="hidden"
                                                            onChange={handleFileChange}
                                                        />
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
                                                                <Upload className={cn(
                                                                    "w-5 h-5",
                                                                    dbUser?.role === 'dealer' ? "text-purple-600" : "text-[#FFCE00]"
                                                                )} />
                                                            </div>
                                                            <p className="text-xs font-bold text-black dark:text-white">
                                                                {bulkFile ? bulkFile.name : 'Click to upload Excel file'}
                                                            </p>
                                                            <p className="text-[10px] text-gray-400">or drag and drop here</p>
                                                        </div>
                                                    </div>

                                                    {bulkFile && (
                                                        <Button
                                                            className={cn(
                                                                "w-full font-black py-6 rounded-2xl shadow-lg text-sm transition-all",
                                                                dbUser?.role === 'dealer'
                                                                    ? "bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-purple-600/20"
                                                                    : "bg-[#FFCE00] hover:bg-[#FFCE00]/90 text-black shadow-[#FFCE00]/20"
                                                            )}
                                                            onClick={handleValidateExcel}
                                                            disabled={isValidating}
                                                        >
                                                            {isValidating ? (
                                                                <>
                                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                    Validating...
                                                                </>
                                                            ) : (
                                                                <div className="flex items-center gap-2">
                                                                    <Check className="w-4 h-4" />
                                                                    Validate Excel
                                                                </div>
                                                            )}
                                                        </Button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Validation Results */}
                                    {validationResults.length > 0 && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-lg border border-gray-100 dark:border-zinc-800">
                                                <div className={cn(
                                                    "px-6 py-4 flex items-center justify-between",
                                                    dbUser?.role === 'dealer' ? "bg-purple-600" : "bg-[#FFCE00]"
                                                )}>
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-white/20 p-1 rounded-lg">
                                                            <CheckCircle2 className={cn(
                                                                "w-4 h-4",
                                                                dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                            )} />
                                                        </div>
                                                        <h3 className={cn(
                                                            "font-black",
                                                            dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                        )}>Order List ({validationResults.length})</h3>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={cn(
                                                                "h-7 text-[10px] font-bold px-2",
                                                                dbUser?.role === 'dealer' ? "text-white hover:bg-white/10" : "text-black hover:bg-black/10"
                                                            )}
                                                            onClick={clearInvalid}
                                                        >
                                                            Clear All Invalid
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className={cn(
                                                                "h-7 text-[10px] font-bold px-2",
                                                                dbUser?.role === 'dealer' ? "text-white/80 hover:bg-white/10" : "text-red-600 hover:bg-red-50"
                                                            )}
                                                            onClick={clearAllResults}
                                                        >
                                                            Clear All
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="max-h-[300px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-50/50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-10">
                                                            <tr>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">STATUS</th>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">RECIPIENT</th>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">DATA</th>
                                                                <th className="px-6 py-3 text-left font-black text-gray-400">PRICE</th>
                                                                <th className="px-0 py-3 text-center"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-50 dark:divide-zinc-800">
                                                            {validationResults.map((res, i) => (
                                                                <tr key={i} className="group hover:bg-gray-50/50 dark:hover:bg-zinc-800/50 transition-colors">
                                                                    <td className="px-6 py-4">
                                                                        <div className={cn(
                                                                            "w-2 h-2 rounded-full",
                                                                            res.isValid ? "bg-[#25D366]" : "bg-[#E60000]"
                                                                        )} />
                                                                    </td>
                                                                    <td className="px-6 py-4">
                                                                        <div className="font-bold text-black dark:text-white">{res.phoneNumber}</div>
                                                                        <div className={cn(
                                                                            "text-[10px] font-bold",
                                                                            res.isValid ? "text-[#25D366]" : "text-[#E60000]"
                                                                        )}>
                                                                            {res.isValid ? (res.successMessage || 'Ready') : res.errorMessage}
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-6 py-4 font-bold text-gray-500">{res.volume} GB</td>
                                                                    <td className="px-6 py-4 font-black text-black dark:text-white">
                                                                        {res.packagePrice > 0 ? formatCurrency(res.packagePrice) : '-'}
                                                                    </td>
                                                                    <td className="px-2 py-4">
                                                                        <button
                                                                            onClick={() => deleteResult(i)}
                                                                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                                                                        >
                                                                            <X className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* Summary Container */}
                                            <div className={cn(
                                                "rounded-3xl p-4 shadow-xl relative overflow-hidden max-w-md mx-auto w-full",
                                                dbUser?.role === 'dealer'
                                                    ? "bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900"
                                                    : "bg-[#FFCE00]"
                                            )}>
                                                <div className="grid grid-cols-2 gap-4 relative z-10 items-center">
                                                    <div className={cn(
                                                        "text-center space-y-0.5 border-r",
                                                        dbUser?.role === 'dealer' ? "border-white/10" : "border-black/10"
                                                    )}>
                                                        <p className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest opacity-60",
                                                            dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                        )}>Total Cost</p>
                                                        <h2 className={cn(
                                                            "text-2xl font-black leading-tight",
                                                            dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                        )}>{formatCurrency(totalBulkCost)}</h2>
                                                        <p className={cn(
                                                            "text-[9px] font-bold opacity-60 uppercase tracking-tighter",
                                                            dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                        )}>Order value</p>
                                                    </div>
                                                    <div className="text-center space-y-0.5">
                                                        <p className={cn(
                                                            "text-[9px] font-black uppercase tracking-widest opacity-60",
                                                            dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                        )}>Total Data</p>
                                                        <h2 className={cn(
                                                            "text-2xl font-black leading-tight",
                                                            dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                        )}>{totalBulkData} <span className="text-sm">GB</span></h2>
                                                        <p className={cn(
                                                            "text-[9px] font-bold opacity-60 uppercase tracking-tighter",
                                                            dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                        )}>Data Volume</p>
                                                    </div>
                                                </div>

                                                {(walletBalance < 0 || walletBalance - totalBulkCost < 0) && (
                                                    <div className={cn(
                                                        "grid grid-cols-2 gap-4 relative z-10 items-center mt-4 pt-4 border-t",
                                                        dbUser?.role === 'dealer' ? "border-white/10" : "border-black/10"
                                                    )}>
                                                        <div className={cn(
                                                            "text-center space-y-0.5 border-r",
                                                            dbUser?.role === 'dealer' ? "border-white/10" : "border-black/10"
                                                        )}>
                                                            <p className={cn(
                                                                "text-[9px] font-black uppercase tracking-widest opacity-60",
                                                                dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                            )}>Current Debt</p>
                                                            <h3 className={cn(
                                                                "text-sm font-black leading-tight",
                                                                dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                            )}>
                                                                {walletBalance < 0 ? formatCurrency(Math.abs(walletBalance)) : 'GHS 0.00'}
                                                            </h3>
                                                        </div>
                                                        <div className="text-center space-y-0.5">
                                                            <p className={cn(
                                                                "text-[9px] font-black uppercase tracking-widest opacity-60",
                                                                dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                            )}>Debt After Order</p>
                                                            <h3 className={cn(
                                                                "text-sm font-black leading-tight",
                                                                dbUser?.role === 'dealer' ? "text-white" : "text-black"
                                                            )}>
                                                                {walletBalance - totalBulkCost < 0 ? formatCurrency(Math.abs(walletBalance - totalBulkCost)) : 'GHS 0.00'}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Submit Section */}
                                            <div className="flex flex-col items-center justify-center gap-4 py-4 max-w-md mx-auto w-full">
                                                {!unlimitedCredit && walletBalance + creditLimit < totalBulkCost ? (
                                                    <Link href="/dashboard/wallet" className="w-full">
                                                        <Button
                                                            className={cn(
                                                                "w-full font-black py-6 rounded-2xl shadow-xl text-sm h-auto uppercase tracking-widest transition-all",
                                                                dbUser?.role === 'dealer'
                                                                    ? "bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white shadow-purple-600/20"
                                                                    : "bg-[#FFCE00] text-black hover:bg-[#FFCE00]/90 shadow-yellow-500/20"
                                                            )}
                                                        >
                                                            <DollarSign className="w-5 h-5 mr-2" />
                                                            Recharge Wallet
                                                        </Button>
                                                    </Link>
                                                ) : (
                                                    <Button
                                                        className={cn(
                                                            "w-full hover:bg-black/90 font-black py-5 rounded-2xl shadow-xl shadow-black/10 text-sm h-auto flex flex-col items-center gap-1 transition-all",
                                                            dbUser?.role === 'dealer' ? "bg-black text-purple-400 border border-purple-900/50" : "bg-black text-[#FFCE00]"
                                                        )}
                                                        onClick={handleSubmitBulkOrder}
                                                        disabled={isSubmittingBulk || validationResults.filter(r => r.isValid).length === 0}
                                                    >
                                                        {isSubmittingBulk ? (
                                                            <div className="flex items-center">
                                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                                Processing...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <div className="text-[10px] font-bold opacity-60 flex items-center gap-1 mb-1 bg-white/10 px-3 py-0.5 rounded-full">
                                                                    <DollarSign className="w-2.5 h-2.5" />
                                                                    Buying Power: {unlimitedCredit ? 'Unlimited' : formatCurrency(walletBalance + creditLimit)}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-base tracking-widest">
                                                                    <CheckCircle2 className="w-5 h-5" />
                                                                    SUBMIT ORDERS
                                                                </div>
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2">
                    <Button
                        variant={viewMode === 'grid' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'list' ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => setViewMode('list')}
                    >
                        <List className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Search */}
            <div id="package-filters" className="relative max-w-md mx-auto w-full z-10">
                <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl transition-colors pointer-events-none"></div>
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                <Input
                    placeholder="Search packages..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-11 h-14 bg-black/40 backdrop-blur-xl border-white/10 text-white rounded-2xl focus-visible:ring-primary/50 text-base shadow-lg relative z-10"
                />
            </div>

            {/* Network Tabs */}
            <Tabs value={selectedNetwork} onValueChange={setSelectedNetwork} className="relative z-10">
                <TabsList className="grid grid-cols-4 gap-2 w-full bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl p-1.5 shadow-xl h-auto">
                    {NETWORKS.map((network) => {
                        const getNetworkStyle = () => {
                            if (network === 'MTN') return 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-yellow-400 data-[state=active]:to-yellow-500 data-[state=active]:text-black data-[state=active]:shadow-lg data-[state=active]:shadow-yellow-500/25'
                            if (network === 'Telecel') return 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-rose-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-red-500/25'
                            return 'data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-500 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/25'
                        }

                        return (
                            <TabsTrigger
                                key={network}
                                value={network}
                                className={cn(
                                    "flex items-center justify-center gap-2 text-xs sm:text-sm font-bold px-2 py-3 rounded-xl transition-all duration-300 text-slate-400 hover:text-white data-[state=active]:scale-[1.02]",
                                    getNetworkStyle()
                                )}
                            >
                                <NetworkIcon network={network} size={20} className="mr-0.5 filter drop-shadow-sm" />
                                <span className="hidden sm:inline">{network}</span>
                                <span className="sm:hidden text-[10px] tracking-tight">{network === 'AT-iShare' ? 'AT-iS' : network === 'AT-BigTime' ? 'AT-BT' : network}</span>
                            </TabsTrigger>
                        )
                    })}
                </TabsList>

                <TabsContent id="packages-grid" value={selectedNetwork} className="mt-6">
                    {filteredPackages.length === 0 ? (
                        <Card className="p-12 text-center">
                            <Wifi className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                            <p className="text-muted-foreground">No packages found</p>
                        </Card>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 scroll-smooth">
                            {filteredPackages.map((pkg) => {
                                const networkStyle = pkg.network === 'MTN'
                                    ? { border: 'border-yellow-500/30', glow: 'group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]', iconBg: 'bg-yellow-500/20', textGlow: 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]', badgeBg: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' }
                                    : pkg.network === 'Telecel'
                                        ? { border: 'border-red-500/30', glow: 'group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]', iconBg: 'bg-red-500/20', textGlow: 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]', badgeBg: 'bg-red-500/20 text-red-400 border border-red-500/30' }
                                        : { border: 'border-blue-500/30', glow: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]', iconBg: 'bg-blue-500/20', textGlow: 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]', badgeBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' }

                                return (
                                    <div
                                        key={pkg.id}
                                        className={cn(
                                            "glass-card rounded-[2rem] overflow-hidden relative transition-all duration-300 hover:-translate-y-2 group flex flex-col h-full z-10",
                                            networkStyle.border,
                                            networkStyle.glow
                                        )}
                                    >
                                        <div className="p-1 flex flex-col h-full bg-black/40 backdrop-blur-md">
                                            {/* Top Section: Logo - Size - Badge */}
                                            <div className="flex items-center justify-between p-4 pb-2 relative z-10">
                                                <div className={cn("p-2 rounded-2xl shadow-md transition-transform duration-300 group-hover:scale-110", networkStyle.iconBg)}>
                                                    <NetworkIcon network={pkg.network} size={24} variant="card" />
                                                </div>

                                                <Badge className={cn("text-[10px] font-bold px-2 py-1 shadow-sm uppercase tracking-wider rounded-lg backdrop-blur-md", networkStyle.badgeBg)}>
                                                    {pkg.network}
                                                </Badge>
                                            </div>

                                            {/* Middle Content: Price & Size */}
                                            <div className="flex flex-col items-center justify-center flex-1 space-y-4 py-8 relative z-10">
                                                {/* Size display in center */}
                                                <div className="text-center">
                                                    <h3 className={cn("text-4xl sm:text-5xl lg:text-6xl font-black tracking-tighter transform transition-transform duration-300 group-hover:scale-105", networkStyle.textGlow)}>
                                                        {pkg.size}
                                                    </h3>
                                                </div>

                                                {/* Price badge */}
                                                <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-2 backdrop-blur-md shadow-lg flex flex-col items-center">
                                                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Price</span>
                                                    <div className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                                                        <span className="text-sm text-slate-300 mr-1">GH₵</span>
                                                        {getEffectivePrice(pkg).toFixed(2)}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-300 opacity-80">
                                                    <span className="animate-spin-pause">⏳</span>
                                                    <span className="flex items-center gap-1">
                                                        Instant Delivery
                                                        <span className="animate-pulse text-yellow-400">⚡</span>
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Bottom: Button */}
                                            <div className="p-3 mt-auto">
                                                <Button
                                                    className="w-full rounded-xl h-12 text-sm font-black uppercase tracking-widest border border-white/10 transition-colors shadow-lg bg-white/5 text-white hover:bg-white/10 hover:border-white/20 group-hover:bg-white group-hover:text-black"
                                                    onClick={() => handlePurchaseClick(pkg)}
                                                >
                                                    <ShoppingCart className="w-4 h-4 mr-2" />
                                                    Purchase Now
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3 scroll-smooth">
                            {filteredPackages.map((pkg) => {
                                const networkStyle = pkg.network === 'MTN'
                                    ? { border: 'border-yellow-500/30', glow: 'group-hover:shadow-[0_0_30px_rgba(234,179,8,0.2)]', iconBg: 'bg-yellow-500/20', textGlow: 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]', badgeBg: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' }
                                    : pkg.network === 'Telecel'
                                        ? { border: 'border-red-500/30', glow: 'group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]', iconBg: 'bg-red-500/20', textGlow: 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.5)]', badgeBg: 'bg-red-500/20 text-red-400 border border-red-500/30' }
                                        : { border: 'border-blue-500/30', glow: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]', iconBg: 'bg-blue-500/20', textGlow: 'text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]', badgeBg: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' }

                                return (
                                    <div
                                        key={pkg.id}
                                        className={cn(
                                            "glass-card rounded-[1.5rem] overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer mb-3 group z-10",
                                            networkStyle.border,
                                            networkStyle.glow
                                        )}
                                        onClick={() => handlePurchaseClick(pkg)}
                                    >
                                        <div className="p-4 flex items-center justify-between bg-black/40 backdrop-blur-md">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("p-2 rounded-xl shadow-md transition-transform duration-300 group-hover:scale-110", networkStyle.iconBg)}>
                                                    <NetworkIcon network={pkg.network} size={32} />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className={cn("font-black text-xl leading-none", networkStyle.textGlow)}>{pkg.size}</h3>
                                                        <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider", networkStyle.badgeBg)}>
                                                            {pkg.network}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                        <span className="text-[10px] text-white/50 mr-1">GH₵</span>
                                                        {getEffectivePrice(pkg).toFixed(2)}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Button
                                                    size="sm"
                                                    className="rounded-lg font-black uppercase tracking-widest border border-white/10 transition-colors shadow-lg bg-white/5 text-white hover:bg-white/10 hover:border-white/20 group-hover:bg-white group-hover:text-black hover:scale-105 px-6"
                                                >
                                                    Buy
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Purchase Dialog */}
            <Dialog open={!!selectedPackage} onOpenChange={() => setSelectedPackage(null)}>
                <DialogContent className="w-[95%] max-w-sm sm:max-w-md rounded-2xl p-4 sm:p-6">
                    {purchaseSuccess ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-green-600" />
                            </div>
                            <DialogTitle className="text-xl mb-2">Order Placed Successfully!</DialogTitle>
                            <DialogDescription>
                                {selectedPackage?.size} has been ordered for {phoneNumber}.
                                Your data will be delivered shortly.
                            </DialogDescription>
                            <Button className="mt-6" onClick={() => setSelectedPackage(null)}>
                                Done
                            </Button>
                        </div>
                    ) : (
                        <>
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span className="flex items-center justify-center">
                                        <NetworkIcon network={selectedPackage?.network || ''} size={32} />
                                    </span>
                                    Buy {selectedPackage?.size}
                                </DialogTitle>
                                <DialogDescription>
                                    Enter the phone number to receive the data bundle
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-4">
                                <div className="p-4 rounded-xl bg-muted/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-muted-foreground">Package</span>
                                        <Badge>{selectedPackage?.network}</Badge>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-lg font-semibold">{selectedPackage?.size}</span>
                                        <span className="text-lg font-bold text-primary">
                                            {selectedPackage && formatCurrency(getEffectivePrice(selectedPackage))}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone Number</Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        placeholder="0241234567"
                                        value={phoneNumber}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        className={phoneError ? 'border-red-500' : ''}
                                    />
                                    {phoneError && (
                                        <p className="text-sm text-red-500 flex items-center gap-1">
                                            <AlertCircle className="w-4 h-4" />
                                            {phoneError}
                                        </p>
                                    )}
                                </div>

                                {walletBalance < 0 && (
                                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-2">
                                        <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none mb-1">Current Debt</p>
                                        <div className="text-lg font-black text-red-500 tabular-nums">
                                            {formatCurrency(Math.abs(walletBalance))}
                                        </div>
                                    </div>
                                )}

                                {selectedPackage && (walletBalance - getEffectivePrice(selectedPackage) < 0) && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Debt After Purchase</p>
                                        <div className="text-lg font-black text-amber-500 tabular-nums">
                                            {formatCurrency(Math.abs(walletBalance - getEffectivePrice(selectedPackage)))}
                                        </div>
                                    </div>
                                )}

                                {!unlimitedCredit && walletBalance + creditLimit < (selectedPackage ? getEffectivePrice(selectedPackage) : 0) && (
                                    <Alert variant="destructive">
                                        <AlertCircle className="w-4 h-4" />
                                        <AlertDescription>
                                            Insufficient balance. Please top up your wallet.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="text-sm text-muted-foreground">
                                    Buying Power: <span className="font-medium text-foreground">{unlimitedCredit ? 'Unlimited' : formatCurrency(walletBalance + creditLimit)}</span>
                                </div>
                            </div>

                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSelectedPackage(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handlePurchase}
                                    disabled={isPurchasing || !phoneNumber || !!phoneError || (!unlimitedCredit && walletBalance + creditLimit < (selectedPackage ? getEffectivePrice(selectedPackage) : 0))}
                                >
                                    {isPurchasing ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        `Pay ${selectedPackage && formatCurrency(getEffectivePrice(selectedPackage))}`
                                    )}
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}
