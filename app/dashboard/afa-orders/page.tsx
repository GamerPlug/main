'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Loader2, Users, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function AFAOrdersPage() {
    const { dbUser } = useAuth()
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        ghana_card: '',
        location: '',
        region: 'Greater Accra',
        occupation: '',
        notes: ''
    })
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [applicationStatus, setApplicationStatus] = useState<string | null>(null)
    const [applicationPrice, setApplicationPrice] = useState(0)
    const [walletBalance, setWalletBalance] = useState(0)
    const [creditLimit, setCreditLimit] = useState(0)
    const [unlimitedCredit, setUnlimitedCredit] = useState(false)
    const [loadingPrice, setLoadingPrice] = useState(true)

    useEffect(() => {
        checkExistingApplication()
        fetchApplicationPrice()
        fetchWalletBalance()
    }, [dbUser])

    const fetchApplicationPrice = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('key, value')
                .in('key', ['afa_price_user', 'afa_price_agent'])

            if (error) throw error

            const settings = data?.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            const userRole = dbUser?.role || 'user'
            const price = userRole === 'agent'
                ? parseFloat(settings?.afa_price_agent || '10')
                : parseFloat(settings?.afa_price_user || '10')

            setApplicationPrice(price)
        } catch (error) {
            console.error('Error fetching AFA price:', error)
            setApplicationPrice(15) // Default fallback
        } finally {
            setLoadingPrice(false)
        }
    }

    const fetchWalletBalance = async () => {
        if (!dbUser?.id) return
        try {
            const { data } = await (supabase
                .from('wallets')
                .select('balance, credit_limit')
                .eq('user_id', dbUser.id)
                .single() as any)

            if (data) {
                setWalletBalance(data.balance || 0)
                setCreditLimit(data.credit_limit || 0)
                setUnlimitedCredit(!!data.unlimited_credit)
            }
        } catch (error) {
            console.error('Error fetching wallet balance:', error)
        }
    }

    const checkExistingApplication = async () => {
        if (!dbUser) return
        const { data } = await supabase
            .from('afa_orders')
            .select('status')
            .eq('user_id', dbUser.id)
            .single()

        if (data) {
            setApplicationStatus((data as any).status)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            // Check wallet balance (including credit limit)
            const totalBuyingPower = walletBalance + creditLimit
            if (!unlimitedCredit && totalBuyingPower < applicationPrice) {
                toast.error(`Insufficient balance. You need GHS ${applicationPrice.toFixed(2)} (including credit limit)`)
                setIsSubmitting(false)
                return
            }

            // Deduct payment from wallet via atomic RPC
            const { data: deductResult, error: deductError } = await supabase.rpc('deduct_wallet', {
                p_user_id: dbUser!.id,
                p_amount: applicationPrice
            }) as any

            if (deductError || !deductResult?.success) {
                const errorMsg = deductResult?.error || deductError?.message || 'Failed to process payment'
                toast.error(errorMsg)
                setIsSubmitting(false)
                return
            }

            const newBalance = deductResult.new_balance

            // Create wallet transaction
            await (supabase.from('wallet_transactions') as any).insert({
                wallet_id: (deductResult as any).wallet_id, // Note: updated RPC returns wallet_id
                user_id: dbUser?.id,
                type: 'debit',
                amount: applicationPrice,
                description: `AFA Application Fee`,
                source: 'afa_application',
                status: 'completed'
            })

            // Submit application
            const { error } = await (supabase.from('afa_orders') as any).insert({
                user_id: dbUser?.id,
                ...formData,
                status: 'pending',
                payment_amount: applicationPrice
            })

            if (error) {
                // Rollback wallet deduction if application insert fails
                // We use the walletBalance we had before the deduction
                await (supabase
                    .from('wallets') as any)
                    .update({
                        balance: walletBalance,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', deductResult.wallet_id)

                throw error
            }

            toast.success('Application submitted successfully!')
            setApplicationStatus('pending')
            setWalletBalance(newBalance)
        } catch (error) {
            console.error('Error submitting application:', error)
            toast.error('Failed to submit application')
        } finally {
            setIsSubmitting(false)
        }
    }

    if (applicationStatus) {
        return (
            <div className="max-w-xl mx-auto py-12 px-4 relative z-10">
                <div className="glass-card p-8 rounded-[2rem] border-white/5 relative overflow-hidden text-center">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="relative z-10 space-y-6">
                        <div>
                            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Application Status</h2>
                            <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">
                                Your Authorized Field Agent application
                            </p>
                        </div>

                        <div className="w-24 h-24 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                            <Users className="w-10 h-10 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                        </div>

                        <div>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white capitalize tracking-tight mb-2">{applicationStatus}</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto font-medium leading-relaxed">
                                {applicationStatus === 'pending'
                                    ? 'Your application is currently under review by our team. We will contact you shortly.'
                                    : applicationStatus === 'completed'
                                        ? 'Congratulations! You are now an authorized agent.'
                                        : 'Your application has been processed.'}
                            </p>
                        </div>

                        <div className="pt-4">
                            <Button
                                onClick={() => window.location.href = '/dashboard'}
                                className="bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 rounded-xl font-bold h-12 px-8 transition-all"
                            >
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 lg:space-y-8 relative z-10 px-4">
            <div className="text-center mb-10">
                <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md mb-3">
                    Become an <span className="text-transparent bg-clip-text gradient-primary animate-pulse-glow">Agent</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-bold max-w-md mx-auto">
                    Apply to become an Authorized Field Agent (AFA) and earn commissions
                </p>
            </div>

            {/* Price and Balance Card */}
            {loadingPrice ? (
                <div className="glass-card p-8 rounded-[2rem] border-slate-200 dark:border-white/5 flex items-center justify-center shadow-sm dark:shadow-lg bg-white/50 dark:bg-black/40">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
            ) : (
                <div className="glass-card p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-primary/20 bg-white dark:bg-gradient-to-br dark:from-black/60 dark:to-primary/5 relative overflow-hidden shadow-sm dark:shadow-[0_0_30px_rgba(225,0,255,0.05)]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-indigo-500 shadow-[0_0_15px_rgba(225,0,255,0.5)]"></div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                        <div className="bg-slate-50 dark:bg-black/40 p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary/70"></span>
                                Application Fee
                            </p>
                            <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                <span className="text-lg text-slate-400 dark:text-slate-500 mr-1">GHS</span>{applicationPrice.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-slate-50 dark:bg-black/40 p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-inner">
                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70"></span>
                                Buying Power
                            </p>
                            <p className={`text-3xl font-black tracking-tight ${unlimitedCredit || walletBalance + creditLimit >= applicationPrice ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                <span className="text-lg opacity-70 mr-1">GHS</span>{unlimitedCredit ? 'Unlimited' : (walletBalance + creditLimit).toFixed(2)}
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 relative z-10">
                        {unlimitedCredit ? (
                            <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 dark:bg-indigo-500/10 w-fit px-4 py-2 rounded-lg border border-indigo-500/20">
                                <CheckCircle2 className="w-4 h-4" />
                                Unlimited Credit (Free Range) Enabled
                            </div>
                        ) : walletBalance + creditLimit < applicationPrice ? (
                            <div className="bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm font-bold text-rose-600 dark:text-rose-300">
                                    Insufficient balance (including credit limit). Please top up your wallet to proceed with the application.
                                </p>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 w-fit px-4 py-2 rounded-lg border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4" />
                                Buying Power: <span className="text-slate-900 dark:text-white">GHS {(walletBalance + creditLimit).toFixed(2)}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="glass-card rounded-[2xl] border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm dark:shadow-2xl bg-white dark:bg-black/20">
                <div className="p-6 sm:p-8 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Application Form</h2>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Please provide accurate details</p>
                </div>
                <div className="p-6 sm:p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2.5">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Full Name</Label>
                                <Input
                                    required
                                    value={formData.full_name}
                                    onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                                    placeholder="John Doe"
                                    className="h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner px-4 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Phone Number</Label>
                                <Input
                                    required
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                                    placeholder="024xxxxxxx"
                                    className="h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner px-4 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Ghana Card Number</Label>
                            <Input
                                required
                                value={formData.ghana_card}
                                onChange={e => setFormData(p => ({ ...p, ghana_card: e.target.value }))}
                                placeholder="GHA-xxxxxxxxx-x"
                                className="h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner px-4 placeholder:text-slate-400 dark:placeholder:text-slate-600 font-mono"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2.5">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Region</Label>
                                <Select
                                    value={formData.region}
                                    onValueChange={v => setFormData(p => ({ ...p, region: v }))}
                                >
                                    <SelectTrigger className="h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:ring-primary/50 shadow-inner px-4">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white shadow-2xl rounded-xl">
                                        {['Greater Accra', 'Ashanti', 'Western', 'Eastern', 'Central', 'Northern', 'Volta'].map(region => (
                                            <SelectItem key={region} value={region} className="focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white rounded-lg cursor-pointer">{region}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2.5">
                                <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">City/Town</Label>
                                <Input
                                    required
                                    value={formData.location}
                                    onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                    placeholder="Accra"
                                    className="h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner px-4 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div className="space-y-2.5">
                            <Label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Occupation</Label>
                            <Input
                                required
                                value={formData.occupation}
                                onChange={e => setFormData(p => ({ ...p, occupation: e.target.value }))}
                                placeholder="Student, Trader, etc."
                                className="h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner px-4 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                            />
                        </div>

                        <div className="bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/10 dark:border-blue-500/20 p-4 rounded-xl flex gap-3">
                            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-bold text-blue-600 dark:text-blue-300">
                                By submitting this form, you agree to pay GHS {applicationPrice.toFixed(2)} from your wallet for the AFA application processing fee.
                            </p>
                        </div>

                        <div className="pt-2">
                            <Button
                                type="submit"
                                className="w-full h-14 rounded-xl font-black text-white text-base gradient-primary shadow-[0_0_20px_rgba(225,0,255,0.3)] hover:shadow-[0_0_30px_rgba(225,0,255,0.5)] transition-all transform hover:-translate-y-1"
                                disabled={isSubmitting || loadingPrice || walletBalance + creditLimit < applicationPrice}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                                        Processing Payment...
                                    </>
                                ) : (!unlimitedCredit && walletBalance + creditLimit < applicationPrice) ? (
                                    <>Insufficient Balance - Top Up Wallet</>
                                ) : (
                                    <>Submit Application & Pay GHS {applicationPrice.toFixed(2)}</>
                                )}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
