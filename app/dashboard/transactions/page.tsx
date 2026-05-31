'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Search, ArrowUpRight, ArrowDownLeft, Receipt, CreditCard, Wallet as WalletIcon, RefreshCw } from 'lucide-react'
import { WalletTransaction } from '@/types/supabase'

export default function TransactionsPage() {
    const { dbUser, isLoading: isAuthLoading } = useAuth()
    const [transactions, setTransactions] = useState<WalletTransaction[]>([])
    const [filteredTransactions, setFilteredTransactions] = useState<WalletTransaction[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState('')
    const [typeFilter, setTypeFilter] = useState('all')
    const [stats, setStats] = useState({
        total: 0,
        todayCredits: 0,
        todayDebits: 0,
        todayRefunds: 0,
    })

    useEffect(() => {
        if (!isAuthLoading) {
            if (dbUser) {
                fetchTransactions()
            } else {
                setIsLoading(false)
            }
        }
    }, [dbUser, isAuthLoading])

    // Real-time subscription for live transaction updates
    useEffect(() => {
        if (!dbUser) return

        const channel = supabase
            .channel(`transactions-${dbUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${dbUser.id}` }, () => {
                fetchTransactions()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [dbUser])

    useEffect(() => {
        filterTransactions()
    }, [transactions, searchQuery, typeFilter])

    const fetchTransactions = async () => {
        try {
            const { data, error } = await supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', dbUser?.id as any)
                .order('created_at', { ascending: false })

            if (error) throw error
            setTransactions(data || [])

            // Calculate stats
            const today = new Date().toISOString().split('T')[0]
            const todayTxns = (data as any)?.filter((t: any) => t.created_at.startsWith(today)) || []

            setStats({
                total: data?.length || 0,
                todayCredits: todayTxns.filter((t: any) => t.type === 'credit' && t.source !== 'refund').reduce((sum: number, t: any) => sum + t.amount, 0),
                todayDebits: todayTxns.filter((t: any) => t.type === 'debit').reduce((sum: number, t: any) => sum + t.amount, 0),
                todayRefunds: todayTxns.filter((t: any) => t.source === 'refund').reduce((sum: number, t: any) => sum + t.amount, 0),
            })
        } catch (error) {
            console.error('Error fetching transactions:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const filterTransactions = () => {
        let filtered = transactions

        if (typeFilter !== 'all') {
            filtered = filtered.filter(t => t.type === typeFilter)
        }

        if (searchQuery) {
            const query = searchQuery.toLowerCase()
            filtered = filtered.filter(t =>
                t.description.toLowerCase().includes(query) ||
                t.reference?.toLowerCase().includes(query)
            )
        }

        setFilteredTransactions(filtered)
    }

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-96" />
            </div>
        )
    }

    return (
        <div className="space-y-6 lg:space-y-8 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Transactions</h1>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">View and manage your transaction history</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                <div className="glass-card p-5 sm:p-6 rounded-[2xl] flex flex-col justify-between relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/10 dark:group-hover:bg-blue-500/20 transition-colors pointer-events-none"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center shadow-inner">
                            <Receipt className="w-6 h-6 text-blue-600 dark:text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.3)] dark:drop-shadow-[0_0_8px_rgba(96,165,250,0.5)]" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{stats.total}</p>
                    </div>
                </div>

                <div className="glass-card p-5 sm:p-6 rounded-[2xl] flex flex-col justify-between relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/10 dark:group-hover:bg-emerald-500/20 transition-colors pointer-events-none"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center shadow-inner">
                            <CreditCard className="w-6 h-6 text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] dark:drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Today's Income</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(stats.todayCredits)}</p>
                    </div>
                </div>

                <div className="glass-card p-5 sm:p-6 rounded-[2xl] flex flex-col justify-between relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-500/10 dark:group-hover:bg-rose-500/20 transition-colors pointer-events-none"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-rose-500/10 dark:bg-rose-500/20 flex items-center justify-center shadow-inner">
                            <WalletIcon className="w-6 h-6 text-rose-600 dark:text-rose-400 drop-shadow-[0_0_8px_rgba(251,113,133,0.3)] dark:drop-shadow-[0_0_8px_rgba(251,113,133,0.5)]" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Today's Expenses</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(stats.todayDebits)}</p>
                    </div>
                </div>

                <div className="glass-card p-5 sm:p-6 rounded-[2xl] flex flex-col justify-between relative overflow-hidden group border-slate-200 dark:border-white/5 shadow-sm dark:shadow-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 dark:bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/10 dark:group-hover:bg-purple-500/20 transition-colors pointer-events-none"></div>
                    <div className="flex items-center gap-4 mb-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center shadow-inner">
                            <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,0.3)] dark:drop-shadow-[0_0_8px_rgba(192,132,252,0.5)]" />
                        </div>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Today's Refunds</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(stats.todayRefunds)}</p>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 rounded-2xl flex flex-col md:flex-row gap-4 border-slate-200 dark:border-white/5 relative z-10 shadow-sm dark:shadow-lg bg-white/50 dark:bg-black/40 backdrop-blur-xl">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                    <Input
                        placeholder="Search transactions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-11 h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-sm shadow-inner"
                    />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-full md:w-[150px] h-12 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus:ring-primary/50 shadow-inner">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-slate-900/95 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white shadow-2xl rounded-xl">
                        <SelectItem value="all" className="focus:bg-slate-100 dark:focus:bg-white/10 focus:text-slate-900 dark:focus:text-white rounded-lg cursor-pointer">All Types</SelectItem>
                        <SelectItem value="credit" className="focus:bg-emerald-500/10 dark:focus:bg-emerald-500/20 focus:text-emerald-600 dark:focus:text-emerald-400 text-emerald-600 dark:text-emerald-500 rounded-lg cursor-pointer">Credits</SelectItem>
                        <SelectItem value="debit" className="focus:bg-rose-500/10 dark:focus:bg-rose-500/20 focus:text-rose-600 dark:focus:text-rose-400 text-rose-600 dark:text-rose-500 rounded-lg cursor-pointer">Debits</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Transactions Table */}
            <div className="glass-card rounded-[2xl] overflow-hidden border-slate-200 dark:border-white/5 relative z-10 shadow-sm dark:shadow-2xl bg-white/50 dark:bg-black/40 backdrop-blur-xl">
                {filteredTransactions.length === 0 ? (
                    <div className="text-center py-16 px-4">
                        <div className="w-20 h-20 mx-auto bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 shadow-inner">
                            <Receipt className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">No Transactions Found</h3>
                        <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">You haven't made any transactions yet, or none match your search criteria.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto custom-scrollbar">
                        <Table>
                            <TableHeader className="bg-slate-50 dark:bg-black/40 border-b border-slate-100 dark:border-white/5">
                                <TableRow className="hover:bg-transparent border-none">
                                    <TableHead className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] h-12">Type</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] h-12">Description</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] h-12">Reference</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] h-12">Source</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] h-12 text-right">Amount</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] h-12">Status</TableHead>
                                    <TableHead className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px] h-12 text-right">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredTransactions.map((txn) => (
                                    <TableRow key={txn.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                                        <TableCell>
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner ${txn.type === 'credit'
                                                ? 'bg-emerald-500/10 border border-emerald-500/20'
                                                : 'bg-rose-500/10 border border-rose-500/20'
                                                }`}>
                                                {txn.type === 'credit' ? (
                                                    <ArrowDownLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_5px_rgba(52,211,153,0.3)] dark:drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]" />
                                                ) : (
                                                    <ArrowUpRight className="w-5 h-5 text-rose-600 dark:text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.3)] dark:drop-shadow-[0_0_5px_rgba(251,113,133,0.5)]" />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-bold text-slate-900 dark:text-white max-w-[200px] truncate group-hover:text-primary transition-colors">{txn.description}</p>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-black/40 px-2 py-1 rounded-md border border-slate-100 dark:border-white/5">{txn.reference || '-'}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/5 text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 whitespace-nowrap">
                                                {txn.source}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`font-black tracking-tight ${txn.type === 'credit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {txn.type === 'credit' ? '+' : '-'} GH₵ {Math.abs(txn.amount).toFixed(2)}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className={`text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 whitespace-nowrap border ${txn.status === 'completed'
                                                    ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30'
                                                    : txn.status === 'failed'
                                                        ? 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30'
                                                        : 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30'
                                                }`}>
                                                {txn.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right whitespace-nowrap">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold text-slate-900 dark:text-white">{new Date(txn.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{new Date(txn.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    )
}
