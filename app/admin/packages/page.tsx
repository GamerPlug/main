'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Plus,
    Pencil,
    Trash2,
    Loader2,
    Package,
    FileEdit,
    Tag,
    Search,
    X,
    UserCog
} from 'lucide-react'
import { toast } from 'sonner'
import { DataPackage } from '@/types/supabase'

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'] as const

interface PackageFormData {
    network: typeof NETWORKS[number]
    size: string
    price: number
    dealer_price: number
    agent_price: number
    cost_price: number
    description: string
    is_available: boolean
    sort_order: number
}

const defaultFormData: PackageFormData = {
    network: 'MTN',
    size: '',
    price: 0,
    dealer_price: 0,
    agent_price: 0,
    cost_price: 0,
    description: '',
    is_available: true,
    sort_order: 0,
}

export default function AdminPackagesPage() {
    const [packages, setPackages] = useState<DataPackage[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingPackage, setEditingPackage] = useState<DataPackage | null>(null)
    const [formData, setFormData] = useState<PackageFormData>(defaultFormData)
    const [isSaving, setIsSaving] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [isNetworkDescDialogOpen, setIsNetworkDescDialogOpen] = useState(false)
    const [editingNetwork, setEditingNetwork] = useState<typeof NETWORKS[number] | null>(null)
    const [networkDescription, setNetworkDescription] = useState('')
    const [isSavingNetworkDesc, setIsSavingNetworkDesc] = useState(false)

    // ─── Custom (per-user) pricing tab ───────────────────────────────
    const [overrides, setOverrides] = useState<any[]>([])
    const [loadingOverrides, setLoadingOverrides] = useState(false)
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [userSearch, setUserSearch] = useState('')
    const [userResults, setUserResults] = useState<any[]>([])
    const [searchingUsers, setSearchingUsers] = useState(false)
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [assignPackageId, setAssignPackageId] = useState('')
    const [assignPrice, setAssignPrice] = useState('')
    const [assignNote, setAssignNote] = useState('')
    const [isAssigning, setIsAssigning] = useState(false)
    const [deletingOverrideId, setDeletingOverrideId] = useState<string | null>(null)

    useEffect(() => {
        fetchPackages()
        fetchOverrides()
    }, [])

    // Real-time subscription for live package updates
    useEffect(() => {
        const channel = supabase
            .channel('admin-packages')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'data_packages' }, () => {
                fetchPackages()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchPackages = async () => {
        try {
            const res = await fetch('/api/admin/packages')
            if (!res.ok) throw new Error('Failed to fetch packages')
            const data = await res.json()
            setPackages(data || [])
        } catch (error) {
            console.error('Error fetching packages:', error)
            toast.error('Failed to load packages')
        } finally {
            setIsLoading(false)
        }
    }

    const openCreateDialog = () => {
        setEditingPackage(null)
        setFormData(defaultFormData)
        setIsDialogOpen(true)
    }

    const openEditDialog = (pkg: DataPackage) => {
        setEditingPackage(pkg)
        setFormData({
            network: pkg.network as any,
            size: pkg.size,
            price: pkg.price,
            dealer_price: pkg.dealer_price || 0,
            agent_price: pkg.agent_price || 0,
            cost_price: (pkg as any).cost_price || 0,
            description: pkg.description || '',
            is_available: pkg.is_available,
            sort_order: pkg.sort_order || 0,
        })
        setIsDialogOpen(true)
    }

    const handleSave = async () => {
        if (!formData.size || !formData.price) {
            toast.error('Please fill in all required fields')
            return
        }

        setIsSaving(true)
        try {
            const method = editingPackage ? 'PUT' : 'POST'
            const body = editingPackage ? { ...formData, id: editingPackage.id } : formData

            const res = await fetch('/api/admin/packages', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to save package')

            toast.success(editingPackage ? 'Package updated successfully' : 'Package created successfully')
            setIsDialogOpen(false)
            fetchPackages()
        } catch (error) {
            console.error('Error saving package:', error)
            toast.error('Failed to save package')
        } finally {
            setIsSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this package?')) return

        setDeletingId(id)
        try {
            const res = await fetch(`/api/admin/packages?id=${id}`, {
                method: 'DELETE',
            })

            if (!res.ok) throw new Error('Failed to delete package')

            toast.success('Package deleted successfully')
            fetchPackages()
        } catch (error) {
            toast.error('Failed to delete package')
        } finally {
            setDeletingId(null)
        }
    }

    const toggleAvailability = async (pkg: DataPackage) => {
        try {
            const res = await fetch('/api/admin/packages', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: pkg.id,
                    is_available: !pkg.is_available
                })
            })

            if (!res.ok) throw new Error('Failed to update package')

            setPackages(prev =>
                prev.map(p => p.id === pkg.id ? { ...p, is_available: !p.is_available } : p)
            )
        } catch (error) {
            toast.error('Failed to update package')
        }
    }

    const openNetworkDescDialog = (network: typeof NETWORKS[number]) => {
        setEditingNetwork(network)
        // Get description from first package of this network
        const networkPackage = packages.find(p => p.network === network)
        setNetworkDescription(networkPackage?.description || '')
        setIsNetworkDescDialogOpen(true)
    }

    const handleSaveNetworkDescription = async () => {
        if (!editingNetwork) return

        setIsSavingNetworkDesc(true)
        try {
            const res = await fetch('/api/admin/packages/network-description', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    network: editingNetwork,
                    description: networkDescription
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to update description')

            toast.success(`Description updated for all ${editingNetwork} packages`)
            setIsNetworkDescDialogOpen(false)
            fetchPackages()
        } catch (error: any) {
            console.error('Error updating network description:', error)
            toast.error(error.message || 'Failed to update description')
        } finally {
            setIsSavingNetworkDesc(false)
        }
    }

    const fetchOverrides = async () => {
        setLoadingOverrides(true)
        try {
            const res = await fetch('/api/admin/user-pricing')
            if (!res.ok) throw new Error('Failed to fetch custom pricing')
            const data = await res.json()
            setOverrides(Array.isArray(data) ? data : [])
        } catch (error) {
            console.error('Error fetching custom pricing:', error)
            toast.error('Failed to load custom pricing')
        } finally {
            setLoadingOverrides(false)
        }
    }

    // Debounced user search for the assign dialog
    useEffect(() => {
        if (!isAssignOpen) return
        const term = userSearch.trim()
        if (term.length < 2) {
            setUserResults([])
            return
        }
        setSearchingUsers(true)
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/admin/users?limit=8&search=${encodeURIComponent(term)}`)
                const data = await res.json()
                setUserResults(data.users || [])
            } catch {
                setUserResults([])
            } finally {
                setSearchingUsers(false)
            }
        }, 400)
        return () => clearTimeout(timer)
    }, [userSearch, isAssignOpen])

    const openAssignDialog = () => {
        setSelectedUser(null)
        setUserSearch('')
        setUserResults([])
        setAssignPackageId('')
        setAssignPrice('')
        setAssignNote('')
        setIsAssignOpen(true)
    }

    const handleAssignPricing = async () => {
        if (!selectedUser) {
            toast.error('Please select a user')
            return
        }
        if (!assignPackageId) {
            toast.error('Please select a package')
            return
        }
        const price = parseFloat(assignPrice)
        if (isNaN(price) || price <= 0) {
            toast.error('Enter a valid price greater than 0')
            return
        }

        setIsAssigning(true)
        try {
            const res = await fetch('/api/admin/user-pricing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: selectedUser.id,
                    packageId: assignPackageId,
                    customPrice: price,
                    note: assignNote || undefined,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to assign pricing')

            toast.success('Custom price assigned')
            setIsAssignOpen(false)
            fetchOverrides()
        } catch (error: any) {
            console.error('Assign pricing error:', error)
            toast.error(error.message || 'Failed to assign pricing')
        } finally {
            setIsAssigning(false)
        }
    }

    const handleDeleteOverride = async (id: string) => {
        if (!confirm('Remove this custom price? The user will revert to their role price.')) return
        setDeletingOverrideId(id)
        try {
            const res = await fetch(`/api/admin/user-pricing?id=${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to remove custom price')
            toast.success('Custom price removed')
            setOverrides(prev => prev.filter(o => o.id !== id))
        } catch (error: any) {
            toast.error(error.message || 'Failed to remove custom price')
        } finally {
            setDeletingOverrideId(null)
        }
    }

    // Group packages by network for display
    const packagesByNetwork = NETWORKS.reduce((acc, network) => {
        acc[network] = packages.filter(p => p.network === network)
        return acc
    }, {} as Record<typeof NETWORKS[number], DataPackage[]>)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Data Packages</h1>
                <p className="text-muted-foreground">Manage packages and per-user custom pricing</p>
            </div>

            <Tabs defaultValue="packages" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="packages" className="gap-2">
                        <Package className="w-4 h-4" />
                        Packages
                    </TabsTrigger>
                    <TabsTrigger value="pricing" className="gap-2">
                        <Tag className="w-4 h-4" />
                        Custom Pricing
                    </TabsTrigger>
                </TabsList>

                {/* ─── Packages tab ─── */}
                <TabsContent value="packages" className="space-y-6">
                    <div className="flex justify-end">
                        <Button onClick={openCreateDialog}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Package
                        </Button>
                    </div>

            {/* Network-based Card Grid */}
            {NETWORKS.map(network => {
                const networkPackages = packagesByNetwork[network]
                if (networkPackages.length === 0) return null

                return (
                    <div key={network} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <span className={`px-3 py-1 rounded-full text-white text-sm ${network === 'MTN' ? 'bg-yellow-500' :
                                    network === 'Telecel' ? 'bg-red-600' :
                                        network === 'AT-iShare' ? 'bg-orange-500' :
                                            'bg-blue-600'
                                    }`}>
                                    {network}
                                </span>
                                <span className="text-muted-foreground text-sm">({networkPackages.length} packages)</span>
                            </h2>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openNetworkDescDialog(network)}
                                className="gap-2"
                            >
                                <FileEdit className="w-4 h-4" />
                                Edit Description
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {networkPackages.map((pkg) => (
                                <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
                                    <CardHeader className="pb-3">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <CardTitle className="text-2xl font-bold">{pkg.size}</CardTitle>
                                                <div className="flex flex-wrap gap-1.5 mt-1">
                                                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50">
                                                        Admin: {formatCurrency(pkg.price)}
                                                    </Badge>
                                                    {(pkg.dealer_price ?? 0) > 0 && (
                                                        <Badge variant="outline" className="text-[10px] text-purple-600 border-purple-200 bg-purple-50">
                                                            Dealer: {formatCurrency(pkg.dealer_price ?? 0)}
                                                        </Badge>
                                                    )}
                                                    {(pkg.agent_price ?? 0) > 0 && (
                                                        <Badge variant="outline" className="text-[10px] text-yellow-600 border-yellow-200 bg-yellow-50">
                                                            Agent: {formatCurrency(pkg.agent_price ?? 0)}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Switch
                                                checked={pkg.is_available}
                                                onCheckedChange={() => toggleAvailability(pkg)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {pkg.description || 'No description'}
                                        </p>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => openEditDialog(pkg)}
                                                className="flex-1"
                                            >
                                                <Pencil className="w-4 h-4 mr-2" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => handleDelete(pkg.id)}
                                                disabled={deletingId === pkg.id}
                                            >
                                                {deletingId === pkg.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )
            })}
                </TabsContent>

                {/* ─── Custom Pricing tab ─── */}
                <TabsContent value="pricing" className="space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <p className="text-sm text-muted-foreground max-w-xl">
                            Assign a custom price to a specific user for a specific package. This price
                            overrides their role price and is charged to that user only.
                        </p>
                        <Button onClick={openAssignDialog}>
                            <Plus className="w-4 h-4 mr-2" />
                            Assign Pricing
                        </Button>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            {loadingOverrides ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                </div>
                            ) : overrides.length === 0 ? (
                                <p className="text-center text-muted-foreground py-12 text-sm">
                                    No custom pricing assigned yet. Click “Assign Pricing” to add one.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>User</TableHead>
                                                <TableHead>Package</TableHead>
                                                <TableHead>Role Price</TableHead>
                                                <TableHead>Custom Price</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {overrides.map((o) => {
                                                const u = o.users || {}
                                                const p = o.data_packages || {}
                                                const rolePrice =
                                                    u.role === 'dealer' && (p.dealer_price ?? 0) > 0 ? p.dealer_price
                                                        : u.role === 'agent' && (p.agent_price ?? 0) > 0 ? p.agent_price
                                                            : p.price
                                                return (
                                                    <TableRow key={o.id}>
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium">
                                                                    {`${u.first_name || ''} ${u.last_name || ''}`.trim() || '—'}
                                                                </span>
                                                                <span className="text-xs text-muted-foreground">{u.email}</span>
                                                                {u.role && (
                                                                    <Badge variant="outline" className="mt-1 w-fit text-[10px] capitalize">
                                                                        {u.role}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="font-medium">{p.network}</span>{' '}
                                                            <span className="text-muted-foreground">{p.size}</span>
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground line-through">
                                                            {rolePrice != null ? formatCurrency(rolePrice) : '—'}
                                                        </TableCell>
                                                        <TableCell className="font-semibold text-primary">
                                                            {formatCurrency(o.custom_price)}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="text-destructive hover:text-destructive"
                                                                onClick={() => handleDeleteOverride(o.id)}
                                                                disabled={deletingOverrideId === o.id}
                                                            >
                                                                {deletingOverrideId === o.id ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="w-4 h-4" />
                                                                )}
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingPackage ? 'Edit Package' : 'Create Package'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingPackage ? 'Update the package details' : 'Add a new data package'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Network</Label>
                                <Select
                                    value={formData.network}
                                    onValueChange={(value: typeof NETWORKS[number]) =>
                                        setFormData(prev => ({ ...prev, network: value }))
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {NETWORKS.map((network) => (
                                            <SelectItem key={network} value={network}>
                                                {network}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Size (e.g., 1GB, 5GB)</Label>
                                <Input
                                    value={formData.size}
                                    onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                                    placeholder="1GB"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pricing by Role</Label>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-blue-600 font-bold">Admin Price</Label>
                                    <Input
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-purple-600 font-bold">Dealer Price</Label>
                                    <Input
                                        type="number"
                                        value={formData.dealer_price}
                                        onChange={(e) => setFormData(prev => ({ ...prev, dealer_price: parseFloat(e.target.value) || 0 }))}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-yellow-600 font-bold">Agent Price</Label>
                                    <Input
                                        type="number"
                                        value={formData.agent_price}
                                        onChange={(e) => setFormData(prev => ({ ...prev, agent_price: parseFloat(e.target.value) || 0 }))}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-bold">Cost Price (GHS)</Label>
                                <Input
                                    type="number"
                                    value={formData.cost_price}
                                    onChange={(e) => setFormData(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">Sort Order</Label>
                                <Input
                                    type="number"
                                    value={formData.sort_order}
                                    onChange={(e) => setFormData(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                                value={formData.description}
                                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                placeholder="Package description..."
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={formData.is_available}
                                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_available: checked }))}
                            />
                            <Label>Available for purchase</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            {editingPackage ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Network Description Dialog */}
            <Dialog open={isNetworkDescDialogOpen} onOpenChange={setIsNetworkDescDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit {editingNetwork} Description</DialogTitle>
                        <DialogDescription>
                            This description will be applied to all {editingNetwork} packages
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Network Description</Label>
                            <Textarea
                                value={networkDescription}
                                onChange={(e) => setNetworkDescription(e.target.value)}
                                placeholder="Enter description for all packages on this network..."
                                rows={5}
                            />
                            <p className="text-xs text-muted-foreground">
                                This will update the description for all {editingNetwork} packages
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNetworkDescDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSaveNetworkDescription} disabled={isSavingNetworkDesc}>
                            {isSavingNetworkDesc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Update All {editingNetwork} Packages
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Assign Custom Pricing Dialog */}
            <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Assign Custom Price</DialogTitle>
                        <DialogDescription>
                            Set a per-user price for a package. It overrides the user&apos;s role price.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        {/* User picker */}
                        <div className="space-y-2">
                            <Label>User</Label>
                            {selectedUser ? (
                                <div className="flex items-center justify-between gap-2 rounded-md border p-2.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <UserCog className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {`${selectedUser.first_name || ''} ${selectedUser.last_name || ''}`.trim() || selectedUser.email}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {selectedUser.email} · {selectedUser.role}
                                            </p>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setSelectedUser(null)}>
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        value={userSearch}
                                        onChange={(e) => setUserSearch(e.target.value)}
                                        placeholder="Search by name, email or phone..."
                                        className="pl-9"
                                    />
                                    {(searchingUsers || userResults.length > 0) && (
                                        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                                            {searchingUsers ? (
                                                <div className="flex justify-center p-3">
                                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                                </div>
                                            ) : (
                                                userResults.map((u) => (
                                                    <button
                                                        key={u.id}
                                                        type="button"
                                                        onClick={() => { setSelectedUser(u); setUserResults([]); setUserSearch('') }}
                                                        className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-muted"
                                                    >
                                                        <span className="text-sm font-medium">
                                                            {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">{u.email} · {u.role}</span>
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Package picker */}
                        <div className="space-y-2">
                            <Label>Package</Label>
                            <Select value={assignPackageId} onValueChange={setAssignPackageId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a package" />
                                </SelectTrigger>
                                <SelectContent>
                                    {packages.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.network} {p.size} — {formatCurrency(p.price)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Price */}
                        <div className="space-y-2">
                            <Label>Custom Price (GHS)</Label>
                            <Input
                                type="number"
                                value={assignPrice}
                                onChange={(e) => setAssignPrice(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>

                        {/* Note */}
                        <div className="space-y-2">
                            <Label>Note (optional)</Label>
                            <Input
                                value={assignNote}
                                onChange={(e) => setAssignNote(e.target.value)}
                                placeholder="Reason for custom price..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAssignOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleAssignPricing} disabled={isAssigning}>
                            {isAssigning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Assign Price
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
