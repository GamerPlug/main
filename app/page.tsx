'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
    Smartphone,
    Zap,
    Shield,
    Clock,
    ArrowRight,
    Wifi,
    CreditCard,
    CheckCircle2,
    Sun,
    Moon,
    Gamepad2,
    Terminal,
    Sparkles,
    Cpu
} from 'lucide-react'
import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'
import { WhatsAppCTA } from '@/components/whatsapp-cta'
import { NetworkIcon } from '@/components/network-icon'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'
import { MobileMenu } from '@/components/public/mobile-menu'

export default function HomePage() {
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    return (
        <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden relative font-sans transition-colors duration-300">
            
            {/* Global Cyber Background Overlay */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                {/* Cyber Grid Scanlines */}
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)] opacity-20 dark:opacity-15"></div>
                
                {/* Neon Ambient Glows */}
                <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[600px] sm:w-[900px] h-[600px] sm:h-[900px] bg-primary/10 dark:bg-primary/20 rounded-full blur-[140px] opacity-60"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/4 -translate-x-1/4 w-[500px] sm:w-[700px] h-[500px] sm:h-[700px] bg-secondary/15 dark:bg-secondary/15 rounded-full blur-[120px] opacity-50"></div>
                
                {/* Cybernetic circuit overlay effect using CSS */}
                <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
            </div>

            {/* Navigation Bar */}
            <nav className="fixed top-0 w-full z-50 bg-white/70 dark:bg-[hsl(220_28%_5%)]/70 backdrop-blur-xl border-b border-slate-200/50 dark:border-blue-500/10 shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.6)] transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo and Name */}
                        <div className="flex items-center space-x-3">
                            <div className="relative w-11 h-11 group">
                                <div className="absolute inset-0 bg-primary/30 rounded-xl blur-md group-hover:bg-primary/50 transition-all duration-300"></div>
                                <div className="w-full h-full rounded-xl bg-white/90 dark:bg-black/80 backdrop-blur-md border border-slate-200/80 dark:border-primary/35 flex items-center justify-center relative z-10 transition-all duration-300 group-hover:scale-105">
                                    <Image src="/logo.png" alt="Gamer Plug Logo" fill className="object-contain p-1.5" priority />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-slate-900 via-slate-800 to-slate-600 dark:from-white dark:via-blue-100 dark:to-cyan-200 font-orbitron hidden sm:block uppercase leading-none">
                                    GAMER PLUG
                                </span>
                                <span className="text-[9px] font-bold tracking-widest text-primary hidden sm:block uppercase leading-none mt-1">
                                    SOLUTION
                                </span>
                            </div>
                        </div>

                        {/* Right Navigation Elements */}
                        <div className="flex items-center space-x-2">
                            {/* Theme Toggle Button */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-cyan-400 hover:bg-primary/5 dark:hover:bg-blue-500/10 transition-colors h-10 w-10 rounded-xl hidden sm:flex border border-transparent dark:hover:border-blue-500/20"
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            >
                                {mounted && (theme === 'dark' ? (
                                    <Sun className="w-5 h-5 animate-pulse" />
                                ) : (
                                    <Moon className="w-5 h-5 transition-transform" />
                                ))}
                                <span className="sr-only">Toggle theme</span>
                            </Button>

                            <div className="hidden sm:flex items-center space-x-3">
                                <Link href="/auth/login">
                                    <Button variant="ghost" className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-blue-500/10 font-bold transition-all h-10 px-4 rounded-xl">
                                        Login
                                    </Button>
                                </Link>
                                <Link href="/auth/signup">
                                    <Button className="gradient-primary text-white font-bold h-10 px-6 rounded-xl transition-all hover:scale-105 shadow-[0_0_15px_rgba(37,99,235,0.4)] hover:shadow-[0_0_25px_rgba(37,99,235,0.6)] border border-blue-400/20">
                                        Get Started
                                    </Button>
                                </Link>
                            </div>

                            <MobileMenu />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative pt-32 lg:pt-44 pb-20 px-4 sm:px-6 lg:px-8 z-10 flex flex-col items-center justify-center min-h-[95vh]">
                <div className="max-w-5xl mx-auto text-center animate-slideInUp">
                    {/* Glowing Tech Badge */}
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-slate-100/90 dark:bg-blue-950/30 backdrop-blur-md border border-slate-200 dark:border-blue-500/20 mb-8 animate-float shadow-inner">
                        <span className="relative flex h-3 w-3 mr-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary shadow-[0_0_10px_var(--secondary)]"></span>
                        </span>
                        <span className="text-xs text-slate-700 dark:text-cyan-200 font-black tracking-widest font-orbitron uppercase flex items-center gap-1.5">
                            <Gamepad2 className="w-3.5 h-3.5 text-secondary animate-bounce" /> GHANA'S #1 DATA RESELLER & GAMING HUB
                        </span>
                    </div>

                    {/* Cyber Title */}
                    <h1 className="text-4xl sm:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-950 via-slate-800 to-slate-700 dark:from-white dark:to-white/50 mb-6 drop-shadow-xl tracking-tight leading-[1.05] font-orbitron">
                        POWER UP YOUR
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-500 to-secondary drop-shadow-[0_0_20px_rgba(37,99,235,0.25)] dark:drop-shadow-[0_0_30px_rgba(56,189,248,0.4)]">
                            CONNECTIVITY
                        </span>
                    </h1>
                    
                    {/* Rebranded Subtitle */}
                    <p className="text-lg md:text-xl text-slate-600 dark:text-blue-100/70 max-w-3xl mx-auto mb-10 font-medium leading-relaxed font-sans">
                        Experience ultra-high-speed instant data bundles, airtime, and billing automation. 
                        Specifically optimized for high-performance gamers, stream team leaders, and power users across Ghana.
                    </p>
                    
                    {/* Glowing Actions */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link href="/guest/purchase">
                            <Button size="xl" className="gradient-cyber text-white text-lg px-8 h-14 rounded-2xl font-bold shadow-lg hover:scale-105 transition-all duration-300 flex items-center group relative overflow-hidden">
                                <span className="absolute inset-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:animate-shimmer" />
                                Buy as Guest
                                <Zap className="ml-2.5 w-5 h-5 text-yellow-300 animate-pulse" />
                            </Button>
                        </Link>
                        <Link href="/auth/signup">
                            <Button size="xl" variant="outline" className="bg-slate-100/80 dark:bg-blue-950/20 hover:bg-slate-200 dark:hover:bg-blue-500/10 text-slate-900 dark:text-cyan-100 border-slate-300 dark:border-blue-500/35 text-lg px-8 h-14 rounded-2xl font-bold transition-all duration-300 shadow-md hover:scale-105">
                                Create Account
                            </Button>
                        </Link>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <WhatsAppCTA />
                    </div>
                </div>

                {/* Cyber-styled Network Selector Grid */}
                <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-5xl mx-auto px-4 w-full relative z-10">
                    {[
                        { name: 'MTN', color: 'from-yellow-400/10 to-yellow-400/2', border: 'border-yellow-400/30 hover:border-yellow-400/70', glow: 'hover:shadow-[0_0_30px_rgba(250,204,21,0.25)]' },
                        { name: 'Telecel', color: 'from-red-500/10 to-red-500/2', border: 'border-red-500/30 hover:border-red-500/70', glow: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.25)]' },
                        { name: 'AT-iShare', color: 'from-orange-500/10 to-orange-500/2', border: 'border-orange-500/30 hover:border-orange-500/70', glow: 'hover:shadow-[0_0_30px_rgba(249,115,22,0.25)]' },
                        { name: 'AT-BigTime', color: 'from-orange-600/10 to-orange-600/2', border: 'border-orange-600/30 hover:border-orange-600/70', glow: 'hover:shadow-[0_0_30px_rgba(234,88,12,0.25)]' },
                    ].map((network) => (
                        <div
                            key={network.name}
                            className={cn(
                                "group relative p-6 rounded-2xl bg-white/40 dark:bg-black/60 backdrop-blur-2xl border",
                                network.border,
                                "transition-all duration-500 hover:-translate-y-2 flex flex-col items-center justify-center shadow-md",
                                network.glow
                            )}
                        >
                            <div className={cn("absolute inset-0 bg-gradient-to-br rounded-2xl opacity-50 dark:opacity-80 -z-10", network.color)}></div>
                            <div className="relative z-10 flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-115">
                                <NetworkIcon network={network.name} size={64} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white relative z-10 tracking-wide font-orbitron">{network.name}</h3>
                            <p className="text-[10px] text-slate-500 dark:text-cyan-400 font-bold uppercase tracking-widest relative z-10 mt-1">Instant Delivery</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Showcase Section */}
            <section className="relative py-20 md:py-28 px-4 sm:px-6 lg:px-8 z-10 border-t border-slate-200/50 dark:border-blue-500/15 bg-slate-50/50 dark:bg-[hsl(220_28%_8%)]/60 backdrop-blur-lg transition-colors duration-300">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 lg:mb-24">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-500/10 text-primary border border-blue-500/25 mb-4 text-xs font-bold font-orbitron uppercase">
                            <Cpu className="w-3.5 h-3.5 animate-spin" /> PRO ENGINE ARCHITECTURE
                        </div>
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight font-orbitron">
                            WHY GAMER PLUG <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-blue-400 to-secondary">SOLUTIONS</span>?
                        </h2>
                        <p className="text-slate-600 dark:text-blue-100/70 text-lg max-w-2xl mx-auto font-medium">
                            Our next-generation telecom routing delivers unmatched speeds and stability.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                        {[
                            {
                                icon: Zap,
                                title: '0ms Latency Provisioning',
                                description: 'Our custom API pipelines trigger dispatch triggers in milliseconds. Your bundles land before you respawn.',
                                gradient: 'from-blue-600 to-cyan-500',
                                glow: 'shadow-[0_10px_30px_rgba(56,189,248,0.2)] dark:shadow-[0_0_30px_rgba(56,189,248,0.25)]',
                                border: 'dark:border-cyan-500/30'
                            },
                            {
                                icon: Shield,
                                title: 'Cyber-Safe Escrow',
                                description: 'Fully secured wallet architecture. Every single cedi is guarded by cryptographically signed ledgers.',
                                gradient: 'from-blue-800 to-indigo-600',
                                glow: 'shadow-[0_10px_30px_rgba(37,99,235,0.2)] dark:shadow-[0_0_30px_rgba(37,99,235,0.25)]',
                                border: 'dark:border-blue-500/30'
                            },
                            {
                                icon: Clock,
                                title: '24/7 Redundant Servers',
                                description: 'Engineered with double fallbacks. If one gateway path fails, the system automatically hot-swaps paths instantly.',
                                gradient: 'from-cyan-600 to-indigo-700',
                                glow: 'shadow-[0_10px_30px_rgba(99,102,241,0.2)] dark:shadow-[0_0_30px_rgba(99,102,241,0.25)]',
                                border: 'dark:border-indigo-500/30'
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className={cn(
                                    "group p-8 rounded-2xl bg-white/60 dark:bg-black/45 backdrop-blur-xl border border-slate-200 dark:border-blue-500/10 hover:border-primary/40 dark:hover:border-primary/45 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden shadow-md",
                                    feature.border
                                )}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 dark:group-hover:opacity-100 transition-opacity"></div>

                                <div className={cn("relative w-14 h-14 rounded-xl bg-gradient-to-br", feature.gradient, "flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500", feature.glow)}>
                                    <feature.icon className="w-7 h-7 text-white drop-shadow-md" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 relative z-10 font-orbitron">{feature.title}</h3>
                                <p className="text-slate-600 dark:text-blue-100/60 leading-relaxed relative z-10">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works - Rebranded */}
            <section className="relative py-20 md:py-28 px-4 sm:px-6 lg:px-8 z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 lg:mb-24">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight font-orbitron">
                            DEPLOY SYSTEM IN <span className="text-primary font-black font-orbitron">3 STEPS</span>
                        </h2>
                        <p className="text-slate-600 dark:text-blue-100/70 text-lg max-w-xl mx-auto font-medium">
                            Instant network deployment ready in under 60 seconds.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 lg:gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Register Profile',
                                description: 'Securely create your gamer profile profile with absolute privacy keys.',
                                icon: Smartphone,
                            },
                            {
                                step: '02',
                                title: 'Synchronize Wallet',
                                description: 'Deposit credits directly via Mobile Money or instantly through card channels.',
                                icon: CreditCard,
                            },
                            {
                                step: '03',
                                title: 'Execute Operations',
                                description: 'Pick your high-speed bundle and deploy commands instantly to get data.',
                                icon: CheckCircle2,
                            },
                        ].map((item, index) => (
                            <div key={index} className="relative group p-8 rounded-2xl border border-slate-200 dark:border-blue-500/10 bg-white/50 dark:bg-blue-950/5 hover:bg-white dark:hover:bg-blue-500/5 transition-all duration-300 shadow-md dark:shadow-none">
                                <div className="text-7xl lg:text-8xl font-black text-slate-200 dark:text-blue-500/5 absolute -top-8 -left-4 group-hover:text-primary/10 transition-colors pointer-events-none select-none font-orbitron">
                                    {item.step}
                                </div>
                                <div className="relative z-10 pt-4">
                                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-blue-950/30 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors border border-slate-200 dark:border-blue-500/20 group-hover:border-primary/40">
                                        <item.icon className="w-6 h-6 text-slate-600 dark:text-cyan-300 group-hover:text-primary transition-colors" />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 font-orbitron">{item.title}</h3>
                                    <p className="text-slate-600 dark:text-blue-100/60 leading-relaxed font-medium">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Glowing CTA Panel */}
            <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8 z-10">
                <div className="max-w-5xl mx-auto">
                    <div className="relative overflow-hidden rounded-[2rem] p-10 lg:p-16 text-center border border-slate-200 dark:border-blue-500/25 shadow-xl dark:shadow-[0_0_50px_rgba(37,99,235,0.25)] group transition-all">
                        {/* Interactive cyber background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-900 via-primary to-cyan-900 dark:from-slate-950 dark:via-blue-950 dark:to-cyan-950 opacity-95 transition-transform duration-1000 group-hover:scale-105"></div>
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30 mix-blend-overlay"></div>
                        <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-500/10 rounded-full blur-[80px] pointer-events-none"></div>

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white/10 backdrop-blur-md text-cyan-200 border border-white/10 mb-6 text-xs font-bold font-orbitron uppercase">
                                <Sparkles className="w-3.5 h-3.5 animate-bounce" /> INSTANT LEVEL UP
                            </div>
                            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight font-orbitron">
                                READY TO DEPLOY HIGH-SPEED COMMUNICATOR?
                            </h2>
                            <p className="text-blue-100/80 text-base md:text-lg max-w-2xl mx-auto mb-10 font-medium leading-relaxed font-sans">
                                Unlock bulk pricing discounts, secure developer APIs, and a blazing fast dashboard.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="xl" className="bg-white hover:bg-slate-100 text-primary text-lg px-10 h-16 rounded-2xl font-black shadow-2xl hover:shadow-[0_0_40px_rgba(255,255,255,0.4)] transition-all duration-300 hover:scale-105 flex items-center border border-blue-200/20 font-orbitron uppercase">
                                    Create Free Profile
                                    <ArrowRight className="ml-3 w-6 h-6 animate-pulse" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Community Engagement Section */}
            <section className="relative py-16 md:py-20 px-4 sm:px-6 lg:px-8 z-10 bg-slate-50 dark:bg-black/55 border-t border-slate-200/50 dark:border-blue-500/15 backdrop-blur-md transition-colors duration-300">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="mb-10 animate-float">
                        <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-black/60 rounded-2xl border border-slate-200 dark:border-blue-500/20 mb-6 shadow-md shadow-blue-500/5 relative">
                            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-md"></div>
                            <Image src="/logo.png" alt="Gamer Plug Logo" width={48} height={48} className="object-contain relative z-10" />
                        </div>
                        <h3 className="font-black text-2xl text-slate-900 dark:text-white tracking-wider font-orbitron uppercase">
                            THE GAMER PLUG COMM-LINK
                        </h3>
                        <p className="text-slate-600 dark:text-blue-100/60 text-base max-w-lg mx-auto font-medium mt-3">
                            Connect with thousands of gamers and resellers. Access exclusive coupon drops, network updates, and platform release notes.
                        </p>
                    </div>
                    
                    <div className="bg-white/60 dark:bg-black/50 p-6 rounded-3xl border border-slate-200 dark:border-blue-500/15 inline-block w-full max-w-2xl shadow-sm">
                        <WhatsAppCommunityButtons />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-blue-500/10 bg-slate-100 dark:bg-[hsl(220_28%_4%)] z-10 transition-colors">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl gradient-cyber flex items-center justify-center shadow-lg shadow-primary/20 border border-blue-400/20">
                                <Gamepad2 className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-base font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-cyan-200 font-orbitron uppercase leading-none">
                                    GAMER PLUG
                                </span>
                                <span className="text-[8px] font-bold text-primary tracking-widest uppercase mt-0.5 leading-none">
                                    SOLUTION
                                </span>
                            </div>
                        </div>
                        <p className="text-slate-500 dark:text-cyan-500/50 font-bold text-xs tracking-widest font-orbitron uppercase">
                            © {new Date().getFullYear()} GAMER PLUG SOLUTION. ALL SYSTEMS OPERATIONAL.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
