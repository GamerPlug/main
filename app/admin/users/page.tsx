'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Search,
    MoreVertical,
    Ban,
    CheckCircle,
    Wallet,
    UserCog,
    Shield,
    Loader2,
    Trash2,
    Store,
    Phone,
    Calendar,
    Mail,
    Download
} from 'lucide-react'
import { toast } from 'sonner'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { roleConfig, UserRole } from '@/lib/roles'

export default function AdminUsersPage() {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [debouncedSearch, setDebouncedSearch] = useState('')
    const [roleFilter, setRoleFilter] = useState('all')
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [hasMore, setHasMore] = useState(true)
    // Track which user IDs have an in-flight per-user action
    const [actionLoadingIds, setActionLoadingIds] = useState<Set<string>>(new Set())
    const ITEMS_PER_PAGE = 20

    // Wallet Adjustment Dialog State
    const [adjustmentDialogUser, setAdjustmentDialogUser] = useState<any>(null)
    const [adjustmentAmount, setAdjustmentAmount] = useState('')
    const [adjustmentType, setAdjustmentType] = useState<'credit' | 'debit'>('credit')
    const [adjustmentDescription, setAdjustmentDescription] = useState('Admin manual adjustment')
    const [isAdjusting, setIsAdjusting] = useState(false)

    // Credit Limit Dialog State
    const [creditLimitDialogUser, setCreditLimitDialogUser] = useState<any>(null)
    const [creditLimitAmount, setCreditLimitAmount] = useState('')
    const [isUnlimitedCredit, setIsUnlimitedCredit] = useState(false)
    const [isUpdatingLimit, setIsUpdatingLimit] = useState(false)

    // Refs to avoid stale closures in real-time subscription
    const debouncedSearchRef = useRef(debouncedSearch)
    const roleFilterRef = useRef(roleFilter)
    useEffect(() => { debouncedSearchRef.current = debouncedSearch }, [debouncedSearch])
    useEffect(() => { roleFilterRef.current = roleFilter }, [roleFilter])

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    const fetchUsers = useCallback(async (pageToFetch: number, isNewSearch = false) => {
        try {
            setLoading(true)
            const offset = pageToFetch * ITEMS_PER_PAGE
            const search = debouncedSearchRef.current
            const role = roleFilterRef.current
            const url = `/api/admin/users?limit=${ITEMS_PER_PAGE}&offset=${offset}&search=${encodeURIComponent(search)}&role=${role}`

            const response = await fetch(url)
            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Failed to fetch users')
            }
            const data = await response.json()

            const newUsers = data.users || []
            if (isNewSearch) {
                setUsers(newUsers)
            } else {
                setUsers(prev => [...prev, ...newUsers])
            }

            setTotalCount(data.totalCount || 0)
            setHasMore(newUsers.length === ITEMS_PER_PAGE)
        } catch (error: any) {
            console.error('Error fetching users:', error)
            toast.error(error.message || 'Failed to load users')
        } finally {
            setLoading(false)
        }
    }, [])

    // Fetch on filter/search change
    useEffect(() => {
        setPage(0)
        fetchUsers(0, true)
    }, [debouncedSearch, roleFilter, fetchUsers])

    // Real-time subscription — uses refs so search/role stay current
    useEffect(() => {
        const channel = supabase
            .channel('admin-users')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
                fetchUsers(0, true)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [fetchUsers])

    const loadMore = () => {
        if (!loading && hasMore) {
            const nextPage = page + 1
            setPage(nextPage)
            fetchUsers(nextPage)
        }
    }

    const setUserAction = (userId: string, active: boolean) => {
        setActionLoadingIds(prev => {
            const next = new Set(prev)
            active ? next.add(userId) : next.delete(userId)
            return next
        })
    }

    const handleStatusChange = async (userId: string, newStatus: string) => {
        try {
            setUserAction(userId, true)
            const response = await fetch('/api/admin/users/update-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, status: newStatus })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update user status')

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u))
            toast.success(`User marked as ${newStatus}`)
        } catch (error: any) {
            console.error('Status change error:', error)
            toast.error(error.message || 'Failed to update user status')
        } finally {
            setUserAction(userId, false)
        }
    }

    const handleRoleChange = async (userId: string, newRole: string) => {
        if (!confirm(`Are you sure you want to make this user ${newRole}?`)) return

        try {
            setUserAction(userId, true)
            const response = await fetch('/api/admin/users/role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role: newRole })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update user role')

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
            toast.success(`User role updated to ${newRole}`)
        } catch (error: any) {
            console.error('Role change error:', error)
            toast.error(error.message || 'Failed to update user role')
        } finally {
            setUserAction(userId, false)
        }
    }

    const handleManualAdjustment = async () => {
        if (!adjustmentDialogUser || !adjustmentAmount) return

        const amount = parseFloat(adjustmentAmount)
        if (isNaN(amount) || amount <= 0) {
            toast.error('Invalid amount')
            return
        }

        setIsAdjusting(true)
        try {
            const response = await fetch('/api/admin/users/wallet/adjustment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: adjustmentDialogUser.id,
                    amount,
                    type: adjustmentType,
                    description: adjustmentDescription
                })
            })

            const result = await response.json()
            if (!response.ok) {
                const errorMessage = result.details ? `${result.error}: ${result.details}` : (result.error || 'Failed to adjust wallet')
                throw new Error(errorMessage)
            }

            toast.success(`Wallet ${adjustmentType === 'credit' ? 'credited' : 'debited'} successfully`)
            fetchUsers(0, true)
            setAdjustmentDialogUser(null)
            setAdjustmentAmount('')
        } catch (error: any) {
            console.error('Adjustment error:', error)
            toast.error(error.message || `Failed to ${adjustmentType} wallet`)
        } finally {
            setIsAdjusting(false)
        }
    }

    const handleUpdateUserCreditLimit = async () => {
        if (!creditLimitDialogUser) return

        // When unlimited credit is active, allow 0 as the amount
        const effectiveAmount = isUnlimitedCredit ? '0' : creditLimitAmount
        if (!effectiveAmount) return

        const limit = parseFloat(effectiveAmount)
        if (isNaN(limit) || limit < 0) {
            toast.error('Invalid credit limit')
            return
        }

        setIsUpdatingLimit(true)
        try {
            const response = await fetch('/api/admin/users/wallet/credit-limit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: creditLimitDialogUser.id,
                    creditLimit: limit,
                    unlimitedCredit: isUnlimitedCredit
                })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update credit limit')

            toast.success('Credit limit updated successfully')
            fetchUsers(0, true)
            setCreditLimitDialogUser(null)
            setCreditLimitAmount('')
        } catch (error: any) {
            console.error('Credit limit error:', error)
            toast.error(error.message || 'Failed to update credit limit')
        } finally {
            setIsUpdatingLimit(false)
        }
    }

    const handleSettlementToggle = async (userId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus
        try {
            setUserAction(userId, true)
            const response = await fetch('/api/admin/users/settlement', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, requiresSettlement: newStatus })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to update settlement status')

            setUsers(prev => prev.map(u => u.id === userId ? { ...u, requires_settlement: newStatus } : u))
            toast.success(newStatus ? 'Account halted for settlement' : 'Account activated (settled)')
        } catch (error: any) {
            console.error('Settlement toggle error:', error)
            toast.error(error.message || 'Failed to update settlement status')
        } finally {
            setUserAction(userId, false)
        }
    }

    const handleSettleAndReactivate = async (userId: string) => {
        if (!confirm('Are you sure you want to settle the debt to 0.00 and reactivate this account?')) return

        try {
            setUserAction(userId, true)
            const response = await fetch('/api/admin/users/wallet/settle-reactivate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to settle and reactivate')

            toast.success(`Account reactivated! Settled debt of GHS ${result.settledAmount?.toFixed(2) || 0}`)
            setUsers(prev => prev.map(u =>
                u.id === userId ? { ...u, requires_settlement: false, wallets: { ...u.wallets, balance: 0 } } : u
            ))
        } catch (error: any) {
            console.error('Settle and reactivate error:', error)
            toast.error(error.message || 'Failed to settle and reactivate')
        } finally {
            setUserAction(userId, false)
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('EXTREMELY IMPORTANT:\n\nThis will PERMANENTLY delete the user from both Authentication and Database records.\nThis includes their wallet, orders, and history.\nThis action CANNOT be undone.\n\nAre you sure you want to proceed?')) return

        try {
            setUserAction(userId, true)
            const response = await fetch('/api/admin/users/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            })

            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'Failed to delete user')

            setUsers(prev => prev.filter(u => u.id !== userId))
            toast.success('User permanently deleted')
        } catch (error: any) {
            console.error('Deletion error:', error)
            toast.error(error.message || 'Failed to delete user')
        } finally {
            setUserAction(userId, false)
        }
    }

    const exportToCSV = () => {
        try {
            const usersWithPhones = (Array.isArray(users) ? users : []).filter(u => u.phone_number)

            if (usersWithPhones.length === 0) {
                toast.error('No users with phone numbers to export')
                return
            }

            const csvRows = usersWithPhones.map(u => {
                const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'N/A'
                return `"${fullName}",${u.phone_number}`
            })

            const csvContent = ['Name,Phone', ...csvRows].join('\n')
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
            const link = document.createElement('a')
            const url = URL.createObjectURL(blob)
            const timestamp = new Date().toISOString().split('T')[0]
            link.setAttribute('href', url)
            link.setAttribute('download', `moolre_contacts_${timestamp}.csv`)
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            toast.success(`Exported ${usersWithPhones.length} contacts for Moolre`)
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Failed to export contacts')
        }
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="sticky top-0 bg-background/95 backdrop-blur z-30 py-4 border-b">
                <div className="flex flex-col gap-4">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight text-foreground">
                            User Management
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">{totalCount} accounts</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                id="user-search"
                                name="user-search"
                                placeholder="Search by name, email or phone..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-purple-500 rounded-lg h-9"
                            />
                        </div>
                        <div className="w-full sm:w-40">
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger className="bg-secondary/50 border-0 focus:ring-1 focus:ring-purple-500 rounded-lg h-9 text-sm">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="dealer">Dealer</SelectItem>
                                    <SelectItem value="agent">Agent</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            onClick={exportToCSV}
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto gap-1.5 text-green-700 border-green-200 hover:border-green-400 hover:bg-green-50 rounded-lg h-9"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Export CSV
                        </Button>
                    </div>
                </div>
            </div>

            {/* Content */}
            {loading && users.length === 0 ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                </div>
            ) : users.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground text-sm">
                    No users found matching your search.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {users.map((user) => {
                            const userRole = (user.role || 'agent') as UserRole
                            const config = roleConfig[userRole] || roleConfig['agent']
                            const RoleIcon = config.icon
                            const wallet = Array.isArray(user.wallets) ? user.wallets[0] : user.wallets
                            const isActionLoading = actionLoadingIds.has(user.id)

                            return (
                                <Card
                                    key={user.id}
                                    className={cn(
                                        "group relative overflow-hidden border transition-all duration-200",
                                        "border-border/60 hover:border-border hover:shadow-md",
                                        "bg-card",
                                        isActionLoading && "opacity-60 pointer-events-none"
                                    )}
                                >
                                    {isActionLoading && (
                                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/40 backdrop-blur-[1px]">
                                            <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                                        </div>
                                    )}

                                    <CardContent className="p-5 space-y-4">
                                        {/* Card Header */}
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-3 items-center min-w-0">
                                                <div
                                                    className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center text-white shadow-sm"
                                                    style={{ backgroundColor: config.color }}
                                                >
                                                    <RoleIcon className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h3 className="font-semibold text-sm text-foreground truncate leading-tight">
                                                        {user.first_name} {user.last_name}
                                                    </h3>
                                                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        <span
                                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white leading-none"
                                                            style={{ backgroundColor: config.color }}
                                                        >
                                                            {config.label}
                                                        </span>
                                                        <span className={cn(
                                                            "inline-flex items-center gap-1 text-[10px] font-medium",
                                                            user.status === 'active' ? 'text-emerald-600' : 'text-red-500'
                                                        )}>
                                                            <span className={cn(
                                                                "h-1.5 w-1.5 rounded-full",
                                                                user.status === 'active' ? 'bg-emerald-500' : 'bg-red-400'
                                                            )} />
                                                            {user.status === 'active' ? 'Active' : 'Suspended'}
                                                        </span>
                                                        {user.requires_settlement && (
                                                            <span className="text-[9px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">
                                                                Settlement
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground rounded-md"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-52">
                                                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Wallet</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => {
                                                        setAdjustmentDialogUser(user)
                                                        setAdjustmentType('credit')
                                                        setAdjustmentDescription('Admin manual credit')
                                                    }}>
                                                        <Wallet className="w-4 h-4 mr-2 text-emerald-500" />
                                                        Credit Wallet
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => {
                                                        setAdjustmentDialogUser(user)
                                                        setAdjustmentType('debit')
                                                        setAdjustmentDescription('Admin manual debit')
                                                    }}>
                                                        <Wallet className="w-4 h-4 mr-2 text-red-400" />
                                                        Debit Wallet
                                                    </DropdownMenuItem>
                                                    {(user.role === 'agent' || user.role === 'dealer') && (
                                                        <DropdownMenuItem onClick={() => {
                                                            setCreditLimitDialogUser(user)
                                                            setCreditLimitAmount(String(wallet?.credit_limit || 0))
                                                            setIsUnlimitedCredit(!!wallet?.unlimited_credit)
                                                        }}>
                                                            <Shield className="w-4 h-4 mr-2 text-indigo-400" />
                                                            Set Credit Limit
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground pt-1">Account</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleStatusChange(user.id, user.status === 'suspended' ? 'active' : 'suspended')}>
                                                        {user.status === 'suspended' ? (
                                                            <>
                                                                <CheckCircle className="w-4 h-4 mr-2 text-emerald-500" />
                                                                Activate Account
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Ban className="w-4 h-4 mr-2 text-orange-400" />
                                                                Suspend Account
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleSettlementToggle(user.id, !!user.requires_settlement)}>
                                                        <Shield className={cn("w-4 h-4 mr-2", user.requires_settlement ? "text-emerald-500" : "text-amber-500")} />
                                                        {user.requires_settlement ? 'Clear Settlement' : 'Halt for Settlement'}
                                                    </DropdownMenuItem>
                                                    {user.requires_settlement && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleSettleAndReactivate(user.id)}
                                                            className="text-indigo-600 focus:text-indigo-700 focus:bg-indigo-50"
                                                        >
                                                            <CheckCircle className="w-4 h-4 mr-2" />
                                                            Settle &amp; Reactivate
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground pt-1">Change Role</DropdownMenuLabel>
                                                    {Object.entries(roleConfig)
                                                        .filter(([role]) => role !== user.role)
                                                        .map(([role, cfg]) => (
                                                            <DropdownMenuItem key={role} onClick={() => handleRoleChange(user.id, role as UserRole)}>
                                                                <div className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: cfg.color }} />
                                                                Make {cfg.label}
                                                            </DropdownMenuItem>
                                                        ))}

                                                    <div className="h-px bg-border my-1" />
                                                    <DropdownMenuItem
                                                        onClick={() => handleDeleteUser(user.id)}
                                                        className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Delete User
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>

                                        {/* Contact Details */}
                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-muted-foreground">
                                                <Mail className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                                                <span className="truncate text-xs">{user.email}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Phone className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                                    <span className="text-xs">{user.phone_number || '—'}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                                                    <span className="text-xs">{formatDate(user.created_at).split(',')[0]}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Wallet */}
                                        <div className="flex items-end justify-between pt-1 border-t border-border/50">
                                            <div>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Balance</p>
                                                <p className="text-lg font-semibold text-foreground tabular-nums">
                                                    {formatCurrency(wallet?.balance || 0)}
                                                </p>
                                                {wallet?.unlimited_credit ? (
                                                    <span className="text-[9px] font-medium text-indigo-500 uppercase tracking-wide">
                                                        Unlimited Credit
                                                    </span>
                                                ) : wallet?.credit_limit > 0 ? (
                                                    <span className="text-[9px] text-muted-foreground">
                                                        Limit: {formatCurrency(wallet.credit_limit)}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-3 text-xs rounded-md gap-1.5 border-border hover:border-purple-300 hover:text-purple-600 hover:bg-purple-50"
                                                onClick={() => {
                                                    setAdjustmentDialogUser(user)
                                                    setAdjustmentType('credit')
                                                    setAdjustmentDescription('Admin manual credit')
                                                }}
                                            >
                                                <Wallet className="w-3.5 h-3.5" />
                                                Top up
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>

                    {hasMore && (
                        <div className="flex justify-center py-6">
                            <Button
                                onClick={loadMore}
                                disabled={loading}
                                variant="outline"
                                size="sm"
                                className="min-w-[180px] rounded-lg"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : null}
                                Load more ({users.length} of {totalCount})
                            </Button>
                        </div>
                    )}
                </>
            )}

            {/* Wallet Adjustment Dialog */}
            <Dialog open={!!adjustmentDialogUser} onOpenChange={() => setAdjustmentDialogUser(null)}>
                <DialogContent aria-describedby="adjustment-description">
                    <DialogHeader>
                        <DialogTitle className="font-semibold">
                            {adjustmentType === 'credit' ? 'Credit' : 'Debit'} Wallet
                        </DialogTitle>
                        <DialogDescription id="adjustment-description">
                            {adjustmentType === 'credit' ? 'Add funds to' : 'Deduct funds from'}{' '}
                            {adjustmentDialogUser?.first_name} {adjustmentDialogUser?.last_name}&apos;s wallet.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Adjustment Type</Label>
                            <Select
                                value={adjustmentType}
                                onValueChange={(value: 'credit' | 'debit') => setAdjustmentType(value)}
                            >
                                <SelectTrigger id="adjustment-type" name="adjustment-type" className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="credit">Credit (+)</SelectItem>
                                    <SelectItem value="debit">Debit (−)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Amount (GHS)</Label>
                            <Input
                                id="adjustment-amount"
                                name="adjustment-amount"
                                type="number"
                                value={adjustmentAmount}
                                onChange={(e) => setAdjustmentAmount(e.target.value)}
                                placeholder="0.00"
                                className="h-9"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-sm">Description</Label>
                            <Input
                                id="adjustment-description"
                                name="adjustment-description"
                                value={adjustmentDescription}
                                onChange={(e) => setAdjustmentDescription(e.target.value)}
                                className="h-9"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setAdjustmentDialogUser(null)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            variant={adjustmentType === 'debit' ? 'destructive' : 'default'}
                            onClick={handleManualAdjustment}
                            disabled={isAdjusting}
                        >
                            {isAdjusting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                            {adjustmentType === 'credit' ? 'Credit Wallet' : 'Debit Wallet'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Credit Limit Dialog */}
            <Dialog open={!!creditLimitDialogUser} onOpenChange={() => setCreditLimitDialogUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-semibold">Set Credit Limit</DialogTitle>
                        <DialogDescription>
                            Configure the maximum negative balance for{' '}
                            {creditLimitDialogUser?.first_name} {creditLimitDialogUser?.last_name}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-sm">Credit Limit (GHS)</Label>
                            <Input
                                type="number"
                                value={creditLimitAmount}
                                onChange={(e) => setCreditLimitAmount(e.target.value)}
                                placeholder="0.00"
                                disabled={isUnlimitedCredit}
                                className="h-9"
                            />
                            <p className="text-xs text-muted-foreground">
                                Allows purchases even with a zero or negative balance, up to this limit.
                            </p>
                        </div>

                        <div className="flex items-center justify-between p-4 rounded-lg border bg-secondary/30">
                            <div>
                                <p className="text-sm font-medium">Unlimited Credit</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Free Range mode — bypasses all balance checks.
                                </p>
                            </div>
                            <Switch
                                checked={isUnlimitedCredit}
                                onCheckedChange={(checked) => {
                                    setIsUnlimitedCredit(checked)
                                    if (checked) setCreditLimitAmount('0')
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCreditLimitDialogUser(null)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            onClick={handleUpdateUserCreditLimit}
                            disabled={isUpdatingLimit}
                            className={cn(isUnlimitedCredit && "bg-indigo-600 hover:bg-indigo-700")}
                        >
                            {isUpdatingLimit && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                            {isUnlimitedCredit ? 'Confirm Unlimited' : 'Update Limit'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
