'use client'

import { useEffect, useState, Suspense } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, calculatePaystackFee, cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import {
    Wallet,
    Plus,
    ArrowUpRight,
    ArrowDownLeft,
    CreditCard,
    Smartphone,
    Building,
    Loader2,
    TrendingUp,
    TrendingDown,
    AlertTriangle,
    MessageSquare,
    MessageCircle,
    Send
} from 'lucide-react'
import { toast } from 'sonner'
import { WalletTransaction } from '@/types/supabase'
import { usePageAccess } from '@/hooks/use-page-access'
import { useTutorial } from '@/hooks/useTutorial'
import { HelpButton } from '@/components/tutorial/HelpButton'

const QUICK_AMOUNTS = [50, 100, 200, 500]
const MIN_AMOUNT = 5

function WalletContent() {
    const { dbUser, isAdmin, isLoading: isAuthLoading } = useAuth()
    const router = useRouter()
    const { isPageAccessible } = usePageAccess()
    const [walletBalance, setWalletBalance] = useState(0)
    const [creditLimit, setCreditLimit] = useState(0)
    const [totalCredited, setTotalCredited] = useState(0)
    const [totalDebited, setTotalDebited] = useState(0)
    const [unlimitedCredit, setUnlimitedCredit] = useState(false)
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [topUpAmount, setTopUpAmount] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [paystackFeePercent, setPaystackFeePercent] = useState(1.95)
    const [isWalletTopupEnabled, setIsWalletTopupEnabled] = useState(true)
    const searchParams = useSearchParams()

    // Tutorial hook
    const userRole = dbUser?.role === 'agent' ? 'agent' : 'user'
    const { startTutorial } = useTutorial(userRole as 'user' | 'agent', '/wallet')

    // Check if wallet page is accessible
    const isWalletAccessible = isAdmin || isPageAccessible('/dashboard/wallet')

    // Block access if page is disabled for non-admin users
    useEffect(() => {
        if (!isWalletAccessible) {
            toast.error('Wallet is temporarily unavailable')
            router.push('/dashboard')
        }
    }, [isWalletAccessible, router])

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) {
                fetchWalletData()
            } else {
                setIsLoading(false)
            }
        }
    }, [dbUser, isAuthLoading])

    // Real-time subscriptions for live wallet updates
    useEffect(() => {
        if (!dbUser) return

        const channel = supabase
            .channel(`wallet-${dbUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchWalletData()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchWalletData()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dbUser])

    useEffect(() => {
        const success = searchParams.get('success')
        const error = searchParams.get('error')

        if (success === 'true') {
            toast.success('Wallet topped up successfully!')
            fetchWalletData()
            // Clean up URL
            router.replace('/dashboard/wallet')
        } else if (error) {
            let message = 'Failed to process payment'
            if (error === 'payment_failed') message = 'Payment was not successful'
            if (error === 'verification_failed') message = 'Could not verify payment'
            if (error === 'no_reference') message = 'Invalid payment reference'

            toast.error(message)
            // Clean up URL
            router.replace('/dashboard/wallet')
        }
    }, [searchParams, router])

    const fetchWalletData = async () => {
        try {
            const [walletRes, txnsRes, feeSettingRes] = await Promise.all([
                // Fetch wallet
                supabase
                    .from('wallets')
                    .select('*')
                    .eq('user_id', dbUser?.id as any)
                    .single(),

                // Fetch top-up transactions
                dbUser?.role === 'agent'
                    ? supabase
                        .from('wallet_transactions')
                        .select('*')
                        .eq('user_id', dbUser?.id as any)
                        .eq('type', 'credit')
                        .or('source.eq.payment,source.eq.admin')
                        .order('created_at', { ascending: false })
                        .limit(50)
                    : supabase
                        .from('wallet_transactions')
                        .select('*')
                        .eq('user_id', dbUser?.id as any)
                        .eq('type', 'credit')
                        .eq('source', 'payment')
                        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
                        .order('created_at', { ascending: false }),

                // Fetch settings
                supabase
                    .from('admin_settings')
                    .select('key, value')
                    .in('key', ['paystack_fee_percent', 'wallet_topup_enabled'])
            ])

            const wallet = walletRes.data
            const txns = txnsRes.data
            const settingsData = feeSettingRes.data || []

            if (wallet) {
                setWalletBalance((wallet as any).balance)
                setCreditLimit((wallet as any).credit_limit || 0)
                setTotalCredited((wallet as any).total_credited)
                setTotalDebited((wallet as any).total_spent)
                setUnlimitedCredit(!!(wallet as any).unlimited_credit)
            }

            setTransactions(txns || [])

            const feeSetting = settingsData.find((s: any) => s.key === 'paystack_fee_percent')
            const topupSetting = settingsData.find((s: any) => s.key === 'wallet_topup_enabled')

            if (feeSetting?.value) {
                const val = feeSetting.value
                const parsed = typeof val === 'string' ? parseFloat(val) : (typeof val === 'number' ? val : 1.95)
                if (!isNaN(parsed)) setPaystackFeePercent(parsed)
            }

            if (topupSetting) {
                setIsWalletTopupEnabled(topupSetting.value !== 'false')
            }
        } catch (error) {
            console.error('Error fetching wallet data:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleQuickAmount = (amount: number) => {
        setTopUpAmount(amount.toString())
    }

    const handleTopUp = async () => {
        const amount = parseFloat(topUpAmount)

        if (isNaN(amount) || amount < MIN_AMOUNT) {
            toast.error(`Minimum amount is ${formatCurrency(MIN_AMOUNT)}`)
            return
        }

        if (!dbUser?.email) {
            toast.error('Please update your profile with an email address')
            return
        }

        setIsProcessing(true)

        try {
            // Initialize payment on server
            const response = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || 'Failed to initialize payment')
            }

            // Redirect to Paystack checkout
            window.location.href = data.authorization_url
        } catch (error: any) {
            toast.error(error.message || 'Failed to process payment')
            setIsProcessing(false)
        }
    }

    const fee = topUpAmount ? calculatePaystackFee(parseFloat(topUpAmount) || 0, paystackFeePercent) : 0
    const totalAmount = topUpAmount ? (parseFloat(topUpAmount) || 0) + fee : 0

    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-48 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 relative z-10 pb-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Load Wallet</h1>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Top up your wallet to continue shopping</p>
                </div>
                <HelpButton onClick={startTutorial} />
            </div>

            {/* Balance Card at top for Agents */}
            {dbUser?.role === 'agent' && (
                <div className="w-full">
                    <div id="wallet-balance-card" className="glass-card rounded-[2rem] p-6 relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_0_30px_rgba(234,179,8,0.1)] bg-yellow-50/30 dark:bg-yellow-500/10">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/5 dark:bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/10 dark:group-hover:bg-yellow-500/20 transition-colors pointer-events-none"></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-yellow-500/10 dark:bg-yellow-500/20 shadow-inner">
                                        <Wallet className="w-6 h-6 text-yellow-600 dark:text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)] dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" />
                                    </div>
                                    <span className="font-bold uppercase tracking-widest text-sm text-yellow-600 dark:text-yellow-500">Wallet Balance</span>
                                </div>
                                <Badge className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 px-3 py-1 text-[10px] uppercase tracking-widest shadow-sm">Active</Badge>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6">
                                <div>
                                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Available Balance</p>
                                    <p className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tighter drop-shadow-sm dark:drop-shadow-md">
                                        <span className="text-2xl text-slate-400 dark:text-slate-300 mr-1">GH₵</span>
                                        {unlimitedCredit ? 'Unlimited' : walletBalance.toFixed(2)}
                                    </p>
                                    {unlimitedCredit ? (
                                        <div className="mt-2 flex items-center gap-2">
                                            <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border-0">
                                                Unlimited Credit (Free Range)
                                            </Badge>
                                        </div>
                                    ) : creditLimit > 0 && (
                                        <div className="mt-2 flex items-center gap-2">
                                            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">
                                                Credit Limit: {formatCurrency(creditLimit)}
                                            </Badge>
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                Total Buying Power: {formatCurrency(walletBalance + creditLimit)}
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-6 w-full sm:w-auto pt-4 sm:pt-0 border-t border-slate-200 dark:border-white/10 sm:border-0">
                                    <div className="bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex-1 sm:flex-none min-w-[120px]">
                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                                            <span>Credited</span>
                                        </div>
                                        <p className="font-black text-slate-900 dark:text-white text-xl">{formatCurrency(totalCredited)}</p>
                                    </div>
                                    <div className="bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex-1 sm:flex-none min-w-[120px]">
                                        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                                            <TrendingDown className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                                            <span>Spent</span>
                                        </div>
                                        <p className="font-black text-slate-900 dark:text-white text-xl">{formatCurrency(totalDebited)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Maintenance Banner - Show when wallet or top-ups are disabled */}
            {((!isAdmin && !isPageAccessible('/dashboard/wallet')) || !isWalletTopupEnabled) && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                                {!isWalletTopupEnabled ? 'Wallet Top-ups Temporarily Unavailable' : 'Wallet Temporarily Unavailable'}
                            </h3>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                {!isWalletTopupEnabled 
                                    ? 'Online wallet top-ups are currently undergoing maintenance. Please try again later or use manual top-up instructions below (for Agents).'
                                    : 'The wallet feature is temporarily unavailable. Please contact support if you need assistance.'}
                            </p>
                            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                                💡 You can still browse packages and check your orders.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className={dbUser?.role === 'agent' ? 'lg:col-span-3' : 'lg:col-span-1'}>
                    <div className={cn("glass-card rounded-[2rem] p-6 relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-[0_0_30px_rgba(6,182,212,0.1)] h-full", dbUser?.role === 'agent' && "hidden")}>
                        <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/10 dark:group-hover:bg-cyan-500/20 transition-colors pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col h-full">
                            <div className="flex items-center justify-between mb-8">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 shadow-inner">
                                        <Wallet className="w-6 h-6 text-cyan-600 dark:text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.3)] dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                                    </div>
                                    <span className="font-bold uppercase tracking-widest text-sm text-cyan-600 dark:text-cyan-400">Your Wallet</span>
                                </div>
                            </div>

                            <div className="flex-1 mb-8">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Available Balance</p>
                                <p className="text-5xl font-black text-slate-900 dark:text-white tracking-tighter drop-shadow-sm dark:drop-shadow-md">
                                    <span className="text-xl text-slate-400 dark:text-slate-300 mr-1">GH₵</span>
                                    {walletBalance.toFixed(2)}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-auto">
                                <div className="bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                                        <TrendingUp className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                                        <span>Credited</span>
                                    </div>
                                    <p className="font-black text-slate-900 dark:text-white text-lg">{formatCurrency(totalCredited)}</p>
                                </div>
                                <div className="bg-white/40 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4">
                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">
                                        <TrendingDown className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                                        <span>Spent</span>
                                    </div>
                                    <p className="font-black text-slate-900 dark:text-white text-lg">{formatCurrency(totalDebited)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Top Up Card */}
                <div id="top-up-form" className={dbUser?.role === 'agent' ? 'lg:col-span-3' : 'lg:col-span-2'}>
                    <div className="glass-card rounded-[2rem] border border-slate-200 dark:border-white/5 relative overflow-hidden group shadow-sm dark:shadow-xl">
                        <div className="p-6 border-b border-slate-100 dark:border-white/5 flex flex-col">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 dark:bg-primary/20 shadow-inner">
                                    <Plus className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.3)] dark:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Top Up Wallet</h2>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Add funds using mobile money, card, or bank transfer.</p>
                                </div>
                            </div>
                            {dbUser?.role === 'agent' && (
                                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest mt-4 bg-rose-500/10 px-3 py-1.5 rounded-lg inline-block w-fit border border-rose-500/20 shadow-sm ml-14">Paystack Charges Applied</span>
                            )}
                        </div>
                        <form onSubmit={(e) => { e.preventDefault(); handleTopUp(); }}>
                            <div className="p-6 space-y-8">
                                {/* Quick Amounts */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Quick Select</Label>
                                    <div className="grid grid-cols-4 gap-3">
                                        {QUICK_AMOUNTS.map((amount) => (
                                            <Button
                                                key={amount}
                                                type="button"
                                                onClick={() => handleQuickAmount(amount)}
                                                className={cn(
                                                    "h-14 rounded-xl text-sm font-black transition-all duration-300 border border-slate-200 dark:border-white/10 border-b-2 hover:-translate-y-1 shadow-sm dark:shadow-md",
                                                    topUpAmount === amount.toString()
                                                        ? "gradient-primary text-white scale-[1.02] border-white/20 shadow-xl"
                                                        : "bg-slate-50 dark:bg-black/40 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-black/60 hover:border-slate-300 dark:hover:border-white/20"
                                                )}
                                            >
                                                {formatCurrency(amount)}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom Amount */}
                                <div className="space-y-3">
                                    <Label htmlFor="amount" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Custom Amount</Label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold">GHS</span>
                                        <Input
                                            id="amount"
                                            type="number"
                                            placeholder="Enter amount"
                                            value={topUpAmount}
                                            onChange={(e) => setTopUpAmount(e.target.value)}
                                            className="pl-14 h-16 text-2xl font-black bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-2xl focus-visible:ring-primary/50 shadow-inner"
                                            min={MIN_AMOUNT}
                                        />
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest pl-1">Minimum: {formatCurrency(MIN_AMOUNT)}</p>
                                </div>

                                {/* Summary */}
                                {topUpAmount && parseFloat(topUpAmount) >= MIN_AMOUNT && (
                                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/5 space-y-3 backdrop-blur-md shadow-inner">
                                        <div className="flex justify-between text-sm font-bold text-slate-600 dark:text-slate-300">
                                            <span>Top-up amount</span>
                                            <span>{formatCurrency(parseFloat(topUpAmount))}</span>
                                        </div>
                                        <div className="flex justify-between text-sm font-bold text-slate-500 dark:text-slate-400">
                                            <span>Transaction fee ({paystackFeePercent}%)</span>
                                            <span>{formatCurrency(fee)}</span>
                                        </div>
                                        <div className="h-px w-full bg-slate-200 dark:bg-white/10 my-2"></div>
                                        <div className="flex justify-between items-center text-slate-900 dark:text-white">
                                            <span className="font-bold uppercase tracking-widest text-xs">Total to pay</span>
                                            <span className="text-xl font-black text-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{formatCurrency(totalAmount)}</span>
                                        </div>
                                    </div>
                                )}

                                {/* Payment Methods */}
                                <div className="space-y-3">
                                    <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1 block">Payment Methods</Label>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/40 text-center flex flex-col items-center justify-center backdrop-blur-sm">
                                            <Smartphone className="w-6 h-6 mb-2 text-yellow-600 dark:text-yellow-400 drop-shadow-sm" />
                                            <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Mobile Money</span>
                                        </div>
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/40 text-center flex flex-col items-center justify-center backdrop-blur-sm">
                                            <CreditCard className="w-6 h-6 mb-2 text-blue-600 dark:text-blue-400 drop-shadow-sm" />
                                            <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Card</span>
                                        </div>
                                        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/40 text-center flex flex-col items-center justify-center backdrop-blur-sm">
                                            <Building className="w-6 h-6 mb-2 text-purple-600 dark:text-purple-400 drop-shadow-sm" />
                                            <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest">Bank</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Pay Button */}
                                <Button
                                    type="submit"
                                    className="w-full h-16 rounded-2xl text-lg font-black tracking-widest uppercase gradient-primary text-white shadow-xl hover:-translate-y-1 hover:glow-primary transition-all border-0"
                                    disabled={!isWalletTopupEnabled || isProcessing || !topUpAmount || parseFloat(topUpAmount) < MIN_AMOUNT}
                                >
                                    {!isWalletAccessible ? (
                                        <>
                                            <AlertTriangle className="w-5 h-5 mr-2" />
                                            Temporarily Unavailable
                                        </>
                                    ) : isProcessing ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="w-5 h-5 mr-2" />
                                            Top Up {topUpAmount && parseFloat(topUpAmount) >= MIN_AMOUNT && formatCurrency(parseFloat(topUpAmount))}
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Recent Transactions */}
            <div id="recent-activity" className="space-y-4">
                <h2 className="text-xl font-black text-slate-900 dark:text-white px-2 tracking-tight drop-shadow-sm dark:drop-shadow-md">{dbUser?.role === 'agent' ? 'Recent Activity' : 'Today'}</h2>
                <div className="glass-card rounded-[2rem] p-4 sm:p-6 border-slate-200 dark:border-white/5 relative z-10 shadow-sm dark:shadow-xl bg-white/50 dark:bg-black/40 backdrop-blur-xl">
                    {transactions.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                                <Wallet className="w-8 h-8 text-slate-500/50" />
                            </div>
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No transactions yet</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {transactions.map((txn) => (
                                <div
                                    key={txn.id}
                                    className="flex items-center justify-between p-4 rounded-2xl bg-white/60 dark:bg-black/40 hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-100 dark:border-white/5 transition-colors group shadow-sm dark:shadow-none"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-inner ${txn.type === 'credit'
                                            ? 'bg-emerald-500/20 shadow-[inset_0_2px_10px_rgba(16,185,129,0.2)]'
                                            : 'bg-rose-500/20 shadow-[inset_0_2px_10px_rgba(225,29,72,0.2)]'
                                            }`}>
                                            {txn.type === 'credit' ? (
                                                <ArrowDownLeft className="w-5 h-5 text-emerald-400 drop-shadow-sm group-hover:scale-110 transition-transform" />
                                            ) : (
                                                <ArrowUpRight className="w-5 h-5 text-rose-400 drop-shadow-sm group-hover:scale-110 transition-transform" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{txn.description}</p>
                                            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
                                                {formatDate(txn.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex flex-col items-end gap-1.5">
                                        <p className={`font-black text-lg tracking-tight ${txn.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'
                                            }`}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </p>
                                        <Badge className={cn("text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 border", txn.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30')}>
                                            {txn.status}
                                        </Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function WalletPage() {
    return (
        <Suspense fallback={
            <div className="space-y-6 p-6">
                <Skeleton className="h-48 w-full max-w-md" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
            </div>
        }>
            <WalletContent />
        </Suspense>
    )
}
