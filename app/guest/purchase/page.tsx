'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getNetworkGradient, cn, formatDate } from '@/lib/utils'
import { validateGhanaianPhone, detectNetwork } from '@/lib/phone-validation'
import { NetworkIcon } from '@/components/network-icon'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Loader2,
    ArrowLeft,
    ShoppingCart,
    Zap,
    Shield,
    CheckCircle2,
    Search,
    Clock,
    XCircle,
    RefreshCw,
    ArrowRight,
    Smartphone,
    Wifi
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import Image from 'next/image'
import { MobileMenu } from '@/components/public/mobile-menu'

const NETWORKS = ['MTN', 'Telecel', 'AT-iShare', 'AT-BigTime'] as const

function GuestPurchaseContent() {
    const searchParams = useSearchParams()
    const router = useRouter()

    const [activeTab, setActiveTab] = useState('purchase')
    const [packages, setPackages] = useState<any[]>([])
    const [selectedNetwork, setSelectedNetwork] = useState<string>('MTN')
    const [isLoading, setIsLoading] = useState(true)
    const [selectedPackage, setSelectedPackage] = useState<any | null>(null)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [email, setEmail] = useState('')
    const [isProcessing, setIsProcessing] = useState(false)
    const [phoneError, setPhoneError] = useState('')
    const [isGuestPurchaseEnabled, setIsGuestPurchaseEnabled] = useState(true)

    // Tracking state
    const [trackRef, setTrackRef] = useState('')
    const [trackedOrder, setTrackedOrder] = useState<any>(null)
    const [isTracking, setIsTracking] = useState(false)

    useEffect(() => {
        fetchPackages()

        // Handle direct tracking from URL
        const ref = searchParams.get('ref')
        const tab = searchParams.get('tab')
        if (ref) {
            setTrackRef(ref)
            handleTrackOrder(ref)
            setActiveTab('track')
        } else if (tab === 'track') {
            setActiveTab('track')
        }

        fetchSettings()
    }, [searchParams])

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('admin_settings')
                .select('*')
                .eq('key', 'guest_purchase_enabled')
                .single()

            if (!error && data) {
                setIsGuestPurchaseEnabled(data.value !== 'false')
            }
        } catch (error) {
            console.error('Error fetching settings:', error)
        }
    }

    const fetchPackages = async () => {
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from('data_packages')
                // Explicit columns — cost_price (admin margin) is intentionally excluded
                .select('id, network, size, price, dealer_price, agent_price, is_available, sort_order, description, created_at')
                .eq('is_available', true)
                .order('sort_order', { ascending: true })

            if (error) throw error
            setPackages(data || [])
        } catch (error: any) {
            toast.error('Failed to load packages')
        } finally {
            setIsLoading(false)
        }
    }

    const handleTrackOrder = async (ref: string) => {
        if (!ref) return
        setIsTracking(true)
        try {
            const phoneValidation = validateGhanaianPhone(ref)

            // Scoped lookups via SECURITY DEFINER RPCs — guest orders are no
            // longer broadly readable; the caller must know the phone or ref.
            const { data, error } = phoneValidation.isValid
                ? await supabase.rpc('get_guest_orders_by_phone', { p_phone: phoneValidation.normalizedNumber })
                : await supabase.rpc('get_guest_order_by_reference', { p_reference: ref })

            if (error) throw error

            const order = Array.isArray(data) ? data[0] : data
            if (!order) {
                setTrackedOrder(null)
                if (ref.length > 5) toast.error('Order not found')
            } else {
                setTrackedOrder(order)
            }
        } catch (error: any) {
            setTrackedOrder(null)
            if (ref.length > 5) toast.error('Order not found')
        } finally {
            setIsTracking(false)
        }
    }

    const filteredPackages = packages.filter(pkg => pkg.network === selectedNetwork)

    const handleInitializePurchase = async () => {
        if (!selectedPackage) {
            toast.error('Please select a package')
            return
        }

        const phoneValidation = validateGhanaianPhone(phoneNumber)
        if (!phoneValidation.isValid) {
            setPhoneError(phoneValidation.error || 'Invalid phone number')
            return
        }

        if (!email || !email.includes('@')) {
            toast.error('Please enter a valid email address')
            return
        }

        // Check network match
        const detectedNet = detectNetwork(phoneNumber)
        const packageNetwork = selectedPackage.network.includes('AT') ? 'AirtelTigo' : selectedPackage.network
        if (detectedNet !== packageNetwork && selectedPackage.network !== 'AT-BigTime') {
            toast.error(`This number is for ${detectedNet}, not ${selectedPackage.network}`)
            return
        }

        setIsProcessing(true)
        try {
            const response = await fetch('/api/guest/purchase/initialize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    packageId: selectedPackage.id,
                    phoneNumber: phoneValidation.normalizedNumber,
                    email: email,
                    network: selectedPackage.network
                })
            })

            const data = await response.json()
            if (!response.ok) throw new Error(data.error || 'Failed to initialize purchase')

            if (data.authorization_url) {
                window.location.href = data.authorization_url
            }
        } catch (error: any) {
            toast.error(error.message)
            setIsProcessing(false)
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle2 className="w-10 h-10 text-green-500" />
            case 'failed': return <XCircle className="w-10 h-10 text-red-500" />
            case 'processing': return <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
            default: return <Clock className="w-10 h-10 text-yellow-500 animate-pulse" />
        }
    }

    return (
        <div className="min-h-screen bg-black text-white relative flex flex-col overflow-x-hidden selection:bg-primary/30">
            {/* Ambient Backgrounds */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20"></div>
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-40"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[100px] opacity-30"></div>
            </div>

            {/* Header */}
            <header className="fixed top-0 w-full z-40 bg-black/60 backdrop-blur-3xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
                <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center space-x-3 group text-xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70 tracking-tight font-orbitron">
                        <ArrowLeft className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                        <span>GAMER PLUG</span>
                    </Link>
                    <div className="flex items-center space-x-2">
                        <div className="hidden sm:flex items-center space-x-4">
                            <Link href="/auth/login">
                                <Button variant="ghost" className="text-slate-300 hover:text-white hover:bg-white/10 font-bold transition-all h-10 px-5 rounded-xl">Login</Button>
                            </Link>
                            <Link href="/auth/signup">
                                <Button className="gradient-primary hover:glow-primary text-white font-bold h-10 px-6 rounded-xl transition-all hover:scale-105">Sign Up</Button>
                            </Link>
                        </div>
                        <MobileMenu />
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 pt-28 md:pt-32 pb-20 relative z-10 w-full">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8 lg:space-y-12">
                    <div className="flex justify-center">
                        <TabsList className="bg-black/40 border border-white/10 p-1.5 h-auto rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                            <TabsTrigger
                                value="purchase"
                                className="px-8 py-3 rounded-xl font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 hover:text-white transition-all"
                            >
                                <ShoppingCart className="w-4 h-4 mr-2" />
                                Buy Data
                            </TabsTrigger>
                            <TabsTrigger
                                value="track"
                                className="px-8 py-3 rounded-xl font-bold data-[state=active]:bg-white/10 data-[state=active]:text-white text-slate-400 hover:text-white transition-all"
                            >
                                <Search className="w-4 h-4 mr-2" />
                                Track Order
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="purchase" className="mt-0 pt-4">
                        {!isGuestPurchaseEnabled ? (
                            <Card className="glass-card border-white/10 relative overflow-hidden p-8 sm:p-12 text-center my-8">
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-400 via-amber-500 to-yellow-600"></div>
                                <div className="flex flex-col items-center gap-6 py-8">
                                    <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20 mb-2">
                                        <Clock className="w-10 h-10 text-yellow-500 animate-pulse" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-3xl font-black text-white tracking-tight">Coming Soon!</h2>
                                        <p className="text-slate-400 font-medium max-w-sm mx-auto">
                                            Guest purchases are currently disabled. We're upgrading our system to serve you better.
                                            Please create an account to start purchasing.
                                        </p>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-4 mt-4">
                                        <Link href="/auth/register">
                                            <Button className="gradient-primary text-white font-bold h-12 px-8 rounded-xl shadow-lg hover:shadow-primary/20 transition-all">
                                                Create Account
                                            </Button>
                                        </Link>
                                        <Link href="/auth/login">
                                            <Button variant="outline" className="border-white/10 text-white font-bold h-12 px-8 rounded-xl hover:bg-white/5 transition-all">
                                                Login Now
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </Card>
                        ) : (
                            <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
                                {/* Left Side: Package Selection */}
                                <div className="lg:col-span-2 space-y-8">
                                    <div className="flex flex-col space-y-3">
                                        <h1 className="text-3xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tight text-center lg:text-left drop-shadow-md whitespace-normal">Choose Data Package</h1>
                                        <p className="text-slate-400 font-bold text-center lg:text-left text-base sm:text-lg">Select your network and the bundle you want to purchase.</p>
                                    </div>

                                    {/* Network Tabs */}
                                    <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                                        {NETWORKS.map((net) => (
                                            <button
                                                key={net}
                                                onClick={() => {
                                                    setSelectedNetwork(net)
                                                    setSelectedPackage(null)
                                                }}
                                                className={cn(
                                                    "px-6 py-3.5 rounded-2xl font-bold transition-all flex items-center space-x-3 border",
                                                    selectedNetwork === net
                                                        ? "bg-white/10 border-white/20 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-105"
                                                        : "glass-card border-white/5 text-slate-400 hover:text-white hover:bg-white/5"
                                                )}
                                            >
                                                <NetworkIcon network={net} size={28} />
                                                <span>{net}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Packages Grid */}
                                    {isLoading ? (
                                        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
                                            {[1, 2, 3, 4].map(i => (
                                                <div key={i} className="h-32 bg-white/5 animate-pulse rounded-[2rem] border border-white/5" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="grid sm:grid-cols-2 gap-4 lg:gap-6">
                                            {filteredPackages.map((pkg) => (
                                                <button
                                                    key={pkg.id}
                                                    onClick={() => setSelectedPackage(pkg)}
                                                    className={cn(
                                                        "relative p-6 sm:p-8 rounded-[2rem] text-left transition-all group overflow-hidden border",
                                                        selectedPackage?.id === pkg.id
                                                            ? "bg-primary/20 border-primary/50 text-white shadow-[0_0_30px_rgba(225,0,255,0.2)] scale-[1.02]"
                                                            : "glass-card border-white/5 hover:bg-white/5 hover:border-white/10"
                                                    )}
                                                >
                                                    {selectedPackage?.id === pkg.id && (
                                                        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>
                                                    )}
                                                    <div className="relative z-10 flex justify-between items-start mb-6">
                                                        <div className={cn(
                                                            "w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-inner",
                                                            getNetworkGradient(pkg.network)
                                                        )}>
                                                            {pkg.size.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div className="bg-black/40 border border-white/10 px-4 py-2 rounded-xl text-white font-black tracking-tight self-center shadow-inner">
                                                            {formatCurrency(pkg.price)}
                                                        </div>
                                                    </div>
                                                    <h3 className="text-2xl font-black text-white relative z-10 tracking-tight">{pkg.size}</h3>
                                                    <p className="text-sm font-bold text-slate-400 mt-1 uppercase tracking-widest relative z-10">{pkg.network} Bundle</p>

                                                    {selectedPackage?.id === pkg.id && (
                                                        <div className="absolute top-6 right-6 text-primary drop-shadow-[0_0_8px_rgba(225,0,255,0.5)]">
                                                            <CheckCircle2 className="w-8 h-8" />
                                                        </div>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Right Side: Checkout Form */}
                                <div className="lg:col-span-1">
                                    <div className="glass-card sticky top-32 rounded-[2.5rem] border-white/5 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                        <div className="h-1.5 w-full bg-gradient-to-r from-primary via-indigo-500 to-cyan-400" />
                                        <div className="p-6 sm:p-8 space-y-8">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shadow-inner">
                                                    <ShoppingCart className="w-6 h-6 text-primary drop-shadow-[0_0_8px_rgba(225,0,255,0.5)]" />
                                                </div>
                                                <h2 className="text-2xl font-black text-white tracking-tight">Quick Checkout</h2>
                                            </div>

                                            {selectedPackage ? (
                                                <div className="p-6 rounded-2xl bg-black/40 border border-primary/20 shadow-inner relative overflow-hidden group">
                                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>
                                                    <div className="space-y-4 relative z-10">
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Package</span>
                                                            <span className="font-black text-white text-base">{selectedPackage.size}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Network</span>
                                                            <span className="font-black text-white text-base">{selectedPackage.network}</span>
                                                        </div>
                                                        <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                                                            <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total</span>
                                                            <span className="text-2xl font-black text-primary drop-shadow-[0_0_8px_rgba(225,0,255,0.3)]">{formatCurrency(selectedPackage.price)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-10 rounded-2xl bg-black/40 border border-dashed border-white/20 text-center space-y-4 flex flex-col items-center justify-center shadow-inner">
                                                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                                        <Zap className="w-8 h-8 text-slate-500" />
                                                    </div>
                                                    <p className="text-sm font-bold text-slate-400">Select a data package to continue</p>
                                                </div>
                                            )}

                                            <div className="space-y-6">
                                                <div className="space-y-2.5">
                                                    <Label htmlFor="phone" className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Recipient Phone Number</Label>
                                                    <Input
                                                        id="phone"
                                                        placeholder="e.g. 0241234567"
                                                        value={phoneNumber}
                                                        onChange={(e) => {
                                                            setPhoneNumber(e.target.value)
                                                            setPhoneError('')
                                                        }}
                                                        className={cn(
                                                            "h-14 bg-black/40 border-white/10 text-white rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner px-5 text-lg font-bold placeholder:font-normal placeholder:text-slate-600",
                                                            phoneError && "border-rose-500 focus-visible:ring-rose-500"
                                                        )}
                                                    />
                                                    {phoneError && <p className="text-xs text-rose-400 font-bold ml-1">{phoneError}</p>}
                                                </div>

                                                <div className="space-y-2.5">
                                                    <Label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Your Email Address</Label>
                                                    <Input
                                                        id="email"
                                                        type="email"
                                                        placeholder="For order tracking & receipt"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        className="h-14 bg-black/40 border-white/10 text-white rounded-xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner px-5 text-base placeholder:text-slate-600"
                                                    />
                                                    <p className="text-[10px] font-bold text-slate-500 ml-1">We will send your order tracking link here.</p>
                                                </div>
                                            </div>

                                            <Button
                                                className="w-full h-16 gradient-primary hover:glow-primary text-white font-black text-lg rounded-2xl shadow-xl transition-all transform hover:-translate-y-1 mt-4"
                                                onClick={handleInitializePurchase}
                                                disabled={!selectedPackage || isProcessing}
                                            >
                                                {isProcessing ? (
                                                    <div className="flex items-center">
                                                        <Loader2 className="w-6 h-6 animate-spin mr-3" />
                                                        Processing...
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center">
                                                        Pay {selectedPackage ? formatCurrency(selectedPackage.price) : ''} Now
                                                        <ArrowRight className="ml-3 w-5 h-5" />
                                                    </div>
                                                )}
                                            </Button>

                                            <div className="pt-6 flex justify-center border-t border-white/5">
                                                <div className="flex items-center space-x-6 text-slate-500 hover:text-white transition-colors">
                                                    <div className="flex flex-col items-center gap-1 group">
                                                        <Zap className="w-5 h-5 group-hover:text-amber-400 transition-colors" />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:block">Fast</span>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1 group">
                                                        <Shield className="w-5 h-5 group-hover:text-emerald-400 transition-colors" />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:block">Secure</span>
                                                    </div>
                                                    <div className="flex flex-col items-center gap-1 group">
                                                        <CheckCircle2 className="w-5 h-5 group-hover:text-blue-400 transition-colors" />
                                                        <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:block">Verified</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="track" className="mt-0 pt-4">
                        <div className="max-w-3xl mx-auto space-y-8">
                            <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                                <div className="h-1.5 w-full bg-gradient-to-r from-primary via-indigo-500 to-cyan-400" />
                                <div className="p-8 sm:p-12 space-y-10">
                                    <div className="text-center space-y-3">
                                        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">Track Your Order</h2>
                                        <p className="text-slate-400 font-bold text-base max-w-md mx-auto">
                                            Enter your order reference code or phone number to see its current status.
                                        </p>
                                    </div>

                                    <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                                        <div className="relative flex-1 group">
                                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-primary transition-colors" />
                                            <Input
                                                className="pl-14 h-16 bg-black/40 border-white/10 text-white rounded-2xl focus-visible:ring-primary/50 focus-visible:border-primary/50 shadow-inner text-lg font-bold placeholder:font-normal placeholder:text-slate-600 w-full"
                                                placeholder="e.g. GST-ABC-123 or 024XXXXXXX"
                                                value={trackRef}
                                                onChange={(e) => setTrackRef(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleTrackOrder(trackRef);
                                                }}
                                            />
                                        </div>
                                        <Button
                                            className="h-16 px-10 font-black text-lg rounded-2xl gradient-primary hover:glow-primary shadow-xl transition-all"
                                            onClick={() => handleTrackOrder(trackRef)}
                                            disabled={isTracking || !trackRef.trim()}
                                        >
                                            {isTracking ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Track'}
                                        </Button>
                                    </div>

                                    {trackedOrder && (
                                        <div className="mt-12 space-y-8 animate-in fade-in slide-in-from-bottom-8">
                                            <div className="flex flex-col items-center justify-center pb-8 border-b border-white/10">
                                                <div className="mb-6 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                                                    {getStatusIcon(trackedOrder.status)}
                                                </div>
                                                <h3 className="text-3xl font-black text-white tracking-tight">
                                                    {trackedOrder.status === 'completed' ? 'Order Completed' :
                                                        trackedOrder.status === 'failed' ? 'Order Failed' :
                                                            trackedOrder.status === 'processing' ? 'Delivery in Progress' : 'Pending Processing'}
                                                </h3>
                                            </div>

                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div className="p-5 rounded-2xl bg-black/40 border border-white/5 shadow-inner space-y-1.5 flex flex-col justify-center">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Zap className="w-3 h-3 text-primary" /> Package</p>
                                                    <p className="font-black text-white text-lg">{trackedOrder.size}</p>
                                                </div>
                                                <div className="p-5 rounded-2xl bg-black/40 border border-white/5 shadow-inner space-y-1.5 flex flex-col justify-center">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Smartphone className="w-3 h-3 text-blue-400" /> Recipient</p>
                                                    <p className="font-bold text-slate-300 text-base">{trackedOrder.phone_number}</p>
                                                </div>
                                                <div className="p-5 rounded-2xl bg-black/40 border border-white/5 shadow-inner space-y-1.5 flex flex-col justify-center">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Wifi className="w-3 h-3 text-emerald-400" /> Network</p>
                                                    <p className="font-black text-white text-lg">{trackedOrder.network}</p>
                                                </div>
                                                <div className="p-5 rounded-2xl bg-black/40 border border-white/5 shadow-inner space-y-1.5 flex flex-col justify-center">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3 h-3 text-amber-400" /> Date</p>
                                                    <p className="font-bold text-slate-300 text-sm whitespace-nowrap overflow-hidden text-ellipsis" title={formatDate(trackedOrder.created_at)}>{formatDate(trackedOrder.created_at)}</p>
                                                </div>
                                            </div>

                                            {trackedOrder.status === 'processing' && (
                                                <div className="bg-primary/10 border border-primary/20 text-white p-6 rounded-2xl flex items-start gap-4 shadow-inner">
                                                    <div className="w-2 h-2 mt-2 rounded-full bg-primary animate-ping flex-shrink-0"></div>
                                                    <div>
                                                        <p className="font-bold text-lg text-primary tracking-tight">Processing your order</p>
                                                        <p className="text-sm text-slate-400 mt-1">Our system is delivering your data bundle right now. This usually takes less than 60 seconds.</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {!trackedOrder && !isTracking && trackRef && (
                                        <div className="text-center py-12 px-6 rounded-2xl bg-black/20 border border-white/5 border-dashed">
                                            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                            <p className="text-lg font-bold text-white mb-2">Order not found</p>
                                            <p className="text-slate-400 text-sm">Please check the reference code and try again.</p>
                                        </div>
                                    )}

                                    {!trackedOrder && !isTracking && !trackRef && (
                                        <div className="text-center py-12 px-6 rounded-2xl bg-black/20 border border-white/5 border-dashed">
                                            <Search className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                                            <p className="text-lg font-bold text-white mb-2">Ready to track</p>
                                            <p className="text-slate-400 text-sm">Enter a reference above to see your order details.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="text-center pt-8">
                                <Link href="/auth/signup" className="inline-flex group items-center glass-card px-8 py-4 rounded-full border-white/10 hover:bg-white/5 transition-all">
                                    <span className="text-white font-bold tracking-tight">Want agent discounts? Create an account today</span>
                                    <div className="ml-3 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary transition-colors">
                                        <ArrowRight className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    )
}

export default function GuestPurchasePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-[#0056B3]" />
            </div>
        }>
            <GuestPurchaseContent />
        </Suspense>
    )
}
