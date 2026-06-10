'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, calculatePaystackFee, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
    Info,
    ChevronRight,
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
    const [rateLimitCountdown, setRateLimitCountdown] = useState(0)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [paystackFeePercent, setPaystackFeePercent] = useState(1.95)
    const [isWalletTopupEnabled, setIsWalletTopupEnabled] = useState(true)
    const searchParams = useSearchParams()

    const userRole = dbUser?.role === 'agent' ? 'agent' : 'user'
    const { startTutorial } = useTutorial(userRole as 'user' | 'agent', '/wallet')

    const isWalletAccessible = isAdmin || isPageAccessible('/dashboard/wallet')
    const isAgent = dbUser?.role === 'agent'

    // Clear countdown interval on unmount
    useEffect(() => {
        return () => { if (countdownRef.current) clearInterval(countdownRef.current) }
    }, [])

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
            router.replace('/dashboard/wallet')
        } else if (error) {
            let message = 'Failed to process payment'
            if (error === 'payment_failed') message = 'Payment was not successful'
            if (error === 'verification_failed') message = 'Could not verify payment'
            if (error === 'no_reference') message = 'Invalid payment reference'
            toast.error(message)
            router.replace('/dashboard/wallet')
        }
    }, [searchParams, router])

    const fetchWalletData = async () => {
        try {
            const [walletRes, txnsRes, feeSettingRes] = await Promise.all([
                supabase
                    .from('wallets')
                    .select('*')
                    .eq('user_id', dbUser?.id as any)
                    .single(),

                isAgent
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
            const response = await fetch('/api/payments/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ amount }),
            })

            const data = await response.json()

            if (response.status === 429) {
                const retryAfter: number = data.retryAfter ?? 60
                toast.error(data.error || 'Too many attempts. Please wait before retrying.')
                setIsProcessing(false)
                // Start visible countdown so user knows exactly when they can retry
                setRateLimitCountdown(retryAfter)
                if (countdownRef.current) clearInterval(countdownRef.current)
                countdownRef.current = setInterval(() => {
                    setRateLimitCountdown((prev) => {
                        if (prev <= 1) {
                            clearInterval(countdownRef.current!)
                            countdownRef.current = null
                            return 0
                        }
                        return prev - 1
                    })
                }, 1000)
                return
            }

            if (!response.ok) {
                throw new Error(data.error || 'Failed to initialize payment')
            }

            window.location.href = data.authorization_url
        } catch (error: any) {
            toast.error(error.message || 'Failed to process payment')
            setIsProcessing(false)
        }
    }

    const parsedAmount = parseFloat(topUpAmount) || 0
    const fee = topUpAmount ? calculatePaystackFee(parsedAmount, paystackFeePercent) : 0
    const totalAmount = topUpAmount ? parsedAmount + fee : 0
    const isAmountValid = topUpAmount !== '' && parsedAmount >= MIN_AMOUNT

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-36" />
                    <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        )
    }

    return (
        <div className="space-y-6 pb-8">

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">My Wallet</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Manage your balance and top up funds</p>
                </div>
                <HelpButton onClick={startTutorial} />
            </div>

            {/* Maintenance Banner — only rendered when top-ups are disabled */}
            {!isWalletTopupEnabled && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Wallet Top-ups Temporarily Unavailable</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            Online top-ups are under maintenance. Please try again later or contact support.
                        </p>
                    </div>
                </div>
            )}

            {/* Balance Card */}
            <div id="wallet-balance-card" className="glass-card rounded-2xl p-6 border border-border">
                <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/10">
                            <Wallet className="w-5 h-5 text-primary" />
                        </div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Wallet Balance</p>
                    </div>
                    <Badge className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-medium text-[11px] px-2.5">
                        Active
                    </Badge>
                </div>

                <div className="mb-5">
                    <p className="text-4xl font-bold text-foreground tracking-tight">
                        <span className="text-lg font-semibold text-muted-foreground mr-1.5">GH₵</span>
                        {unlimitedCredit ? 'Unlimited' : walletBalance.toFixed(2)}
                    </p>

                    {isAgent && (
                        <div className="flex flex-wrap gap-2 mt-3">
                            {unlimitedCredit ? (
                                <Badge className="bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium px-2.5 py-0.5">
                                    Unlimited Credit — Free Range
                                </Badge>
                            ) : creditLimit > 0 && (
                                <>
                                    <Badge variant="outline" className="text-[11px] font-medium px-2.5 py-0.5">
                                        Credit Limit: {formatCurrency(creditLimit)}
                                    </Badge>
                                    <Badge variant="outline" className="text-[11px] font-medium px-2.5 py-0.5 text-muted-foreground">
                                        Total Buying Power: {formatCurrency(walletBalance + creditLimit)}
                                    </Badge>
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Credited</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(totalCredited)}</p>
                    </div>
                    <div>
                        <div className="flex items-center gap-1.5 mb-1">
                            <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Spent</span>
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(totalDebited)}</p>
                    </div>
                </div>
            </div>

            {/* Top Up Card */}
            <div id="top-up-form" className="glass-card rounded-2xl border border-border">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 border border-primary/10">
                            <Plus className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Top Up Wallet</h2>
                            <p className="text-xs text-muted-foreground mt-0.5">Add funds via mobile money, card, or bank transfer</p>
                        </div>
                    </div>
                    {isAgent && (
                        <Badge variant="outline" className="text-[11px] font-medium text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 shrink-0">
                            Paystack fee applies
                        </Badge>
                    )}
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleTopUp() }}>
                    <div className="p-5 space-y-5">

                        {/* Quick Amounts */}
                        <div className="space-y-2">
                            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Quick Select</Label>
                            <div className="grid grid-cols-4 gap-2">
                                {QUICK_AMOUNTS.map((amount) => (
                                    <Button
                                        key={amount}
                                        type="button"
                                        onClick={() => handleQuickAmount(amount)}
                                        className={cn(
                                            "h-11 rounded-xl text-sm font-semibold transition-all duration-200 border",
                                            topUpAmount === amount.toString()
                                                ? "gradient-primary text-white border-primary/20 shadow-sm"
                                                : "bg-secondary text-secondary-foreground hover:bg-primary/10 hover:text-primary hover:border-primary/30 border-border shadow-none"
                                        )}
                                    >
                                        {formatCurrency(amount)}
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="amount" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Custom Amount</Label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground pointer-events-none select-none">GHS</span>
                                <Input
                                    id="amount"
                                    type="number"
                                    placeholder="0.00"
                                    value={topUpAmount}
                                    onChange={(e) => setTopUpAmount(e.target.value)}
                                    className="pl-14 h-13 text-xl font-bold bg-background border-border text-foreground rounded-xl focus-visible:ring-primary/50"
                                    min={MIN_AMOUNT}
                                    step="any"
                                />
                            </div>
                            <p className="text-[11px] text-muted-foreground pl-1">Minimum: {formatCurrency(MIN_AMOUNT)}</p>
                        </div>

                        {/* Fee Summary */}
                        {isAmountValid && (
                            <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-2.5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Top-up amount</span>
                                    <span className="font-semibold text-foreground">{formatCurrency(parsedAmount)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">Transaction fee ({paystackFeePercent}%)</span>
                                    <span className="font-medium text-muted-foreground">{formatCurrency(fee)}</span>
                                </div>
                                <div className="h-px bg-border" />
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-semibold text-foreground">Total to pay</span>
                                    <span className="text-lg font-bold text-primary">{formatCurrency(totalAmount)}</span>
                                </div>
                            </div>
                        )}

                        {/* Payment Methods — informational */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-1.5">
                                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Accepted via Paystack</Label>
                                <Info className="w-3 h-3 text-muted-foreground" />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { icon: Smartphone, label: 'Mobile Money', color: 'text-amber-600 dark:text-amber-400' },
                                    { icon: CreditCard, label: 'Card', color: 'text-blue-600 dark:text-blue-400' },
                                    { icon: Building, label: 'Bank Transfer', color: 'text-violet-600 dark:text-violet-400' },
                                ].map(({ icon: Icon, label, color }) => (
                                    <div key={label} className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border bg-muted/30">
                                        <Icon className={cn('w-4 h-4', color)} />
                                        <span className="text-[11px] font-medium text-muted-foreground text-center leading-tight">{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl text-sm font-semibold gradient-primary text-white shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 border-0"
                            disabled={!isWalletTopupEnabled || isProcessing || !isAmountValid || rateLimitCountdown > 0}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : rateLimitCountdown > 0 ? (
                                <>
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Retry in {rateLimitCountdown}s
                                </>
                            ) : !isWalletTopupEnabled ? (
                                <>
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    Temporarily Unavailable
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    {isAmountValid ? `Top Up ${formatCurrency(parsedAmount)}` : 'Top Up Wallet'}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Recent Transactions */}
            <div id="recent-activity" className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h2 className="text-sm font-semibold text-foreground">
                        {isAgent ? 'Recent Top-ups' : "Today's Top-ups"}
                    </h2>
                    {!isAgent && (
                        <Link
                            href="/dashboard/my-orders"
                            className="flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                            View order history
                            <ChevronRight className="w-3.5 h-3.5" />
                        </Link>
                    )}
                </div>

                <div className="glass-card rounded-2xl border border-border overflow-hidden">
                    {transactions.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-14">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                                <Wallet className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium text-muted-foreground">No transactions yet</p>
                            <p className="text-xs text-muted-foreground/70 mt-0.5">
                                {isAgent ? 'Your top-up history will appear here' : "Today's top-ups will appear here"}
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border">
                            {transactions.map((txn) => (
                                <div
                                    key={txn.id}
                                    className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                                            txn.type === 'credit'
                                                ? 'bg-emerald-50 dark:bg-emerald-500/10'
                                                : 'bg-rose-50 dark:bg-rose-500/10'
                                        )}>
                                            {txn.type === 'credit' ? (
                                                <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                                <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-foreground truncate">{txn.description}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(txn.created_at)}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                                        <p className={cn(
                                            'text-sm font-bold tabular-nums',
                                            txn.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                        )}>
                                            {txn.type === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                                        </p>
                                        <span className={cn(
                                            'inline-flex items-center px-1.5 py-0 rounded-full text-[10px] font-semibold border h-4',
                                            txn.status === 'completed'
                                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'
                                                : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20'
                                        )}>
                                            {txn.status}
                                        </span>
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
            <div className="space-y-6">
                <div className="space-y-1.5">
                    <Skeleton className="h-7 w-36 rounded-lg" />
                    <Skeleton className="h-4 w-56 rounded-lg" />
                </div>
                <Skeleton className="h-44 w-full rounded-2xl" />
                <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
        }>
            <WalletContent />
        </Suspense>
    )
}
