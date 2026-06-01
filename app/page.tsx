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
    CreditCard,
    CheckCircle2,
    Sun,
    Moon,
    Gamepad2,
    Sparkles,
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
        <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

            {/* Navigation Bar */}
            <nav className="fixed top-0 w-full z-50 bg-white/95 dark:bg-card/95 backdrop-blur-sm border-b border-border shadow-sm transition-colors duration-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo and Name */}
                        <div className="flex items-center space-x-3">
                            <div className="w-9 h-9 relative flex-shrink-0">
                                <Image src="/logo.png" alt="Gamer Plug Logo" fill className="object-contain" priority />
                            </div>
                            <div className="flex flex-col hidden sm:flex">
                                <span className="text-base font-black tracking-tight text-foreground leading-none">
                                    GAMER PLUG
                                </span>
                                <span className="text-[9px] font-bold tracking-widest text-primary leading-none mt-0.5 uppercase">
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
                                className="text-muted-foreground hover:text-foreground h-9 w-9 rounded-lg hidden sm:flex"
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            >
                                {mounted && (theme === 'dark' ? (
                                    <Sun className="w-4 h-4" />
                                ) : (
                                    <Moon className="w-4 h-4" />
                                ))}
                                <span className="sr-only">Toggle theme</span>
                            </Button>

                            <div className="hidden sm:flex items-center space-x-2">
                                <Link href="/auth/login">
                                    <Button variant="ghost" className="text-muted-foreground hover:text-foreground font-semibold h-9 px-4 rounded-lg">
                                        Login
                                    </Button>
                                </Link>
                                <Link href="/auth/signup">
                                    <Button className="bg-primary hover:bg-primary/90 text-white font-semibold h-9 px-5 rounded-lg shadow-sm">
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
            <section className="relative pt-28 lg:pt-36 pb-20 px-4 sm:px-6 lg:px-8">
                {/* Subtle background gradient */}
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-blue-50/60 via-white to-white dark:from-primary/5 dark:via-background dark:to-background pointer-events-none" />

                <div className="max-w-4xl mx-auto text-center animate-slideInUp">
                    {/* Status Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-primary/10 border border-blue-200 dark:border-primary/20 mb-8">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0"></span>
                        <span className="text-xs text-primary dark:text-primary font-semibold tracking-wide uppercase">
                            Ghana&apos;s #1 Data Reseller &amp; Gaming Hub
                        </span>
                    </div>

                    {/* Headline */}
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-foreground mb-6 leading-[1.08] tracking-tight">
                        Power Up Your
                        <br />
                        <span className="text-primary">
                            Connectivity
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
                        Instant data bundles, airtime, and billing automation for MTN, Telecel, and AirtelTigo. Fast, affordable, and reliable — built for Ghana.
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        <Link href="/guest/purchase">
                            <Button size="lg" className="bg-primary hover:bg-primary/90 text-white text-base px-8 h-12 rounded-lg font-semibold shadow-sm w-full sm:w-auto">
                                Buy as Guest
                                <Zap className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                        <Link href="/auth/signup">
                            <Button size="lg" variant="outline" className="text-base px-8 h-12 rounded-lg font-semibold w-full sm:w-auto">
                                Create Account
                                <ArrowRight className="ml-2 w-4 h-4" />
                            </Button>
                        </Link>
                    </div>

                    <div className="mt-8 flex justify-center">
                        <WhatsAppCTA />
                    </div>
                </div>

                {/* Network Cards */}
                <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto px-4 w-full">
                    {[
                        { name: 'MTN', borderColor: 'border-yellow-400/50 hover:border-yellow-400', bg: 'hover:bg-yellow-50/50 dark:hover:bg-yellow-500/5' },
                        { name: 'Telecel', borderColor: 'border-red-400/50 hover:border-red-400', bg: 'hover:bg-red-50/50 dark:hover:bg-red-500/5' },
                        { name: 'AT-iShare', borderColor: 'border-orange-400/50 hover:border-orange-400', bg: 'hover:bg-orange-50/50 dark:hover:bg-orange-500/5' },
                        { name: 'AT-BigTime', borderColor: 'border-orange-500/50 hover:border-orange-500', bg: 'hover:bg-orange-50/50 dark:hover:bg-orange-500/5' },
                    ].map((network) => (
                        <div
                            key={network.name}
                            className={cn(
                                "group p-5 rounded-xl bg-white dark:bg-card border border-border shadow-sm",
                                "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                                network.borderColor,
                                network.bg,
                                "flex flex-col items-center justify-center"
                            )}
                        >
                            <div className="flex items-center justify-center mb-3 transition-transform duration-200 group-hover:scale-105">
                                <NetworkIcon network={network.name} size={56} />
                            </div>
                            <h3 className="text-sm font-bold text-foreground">{network.name}</h3>
                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">Instant</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-muted/40 dark:bg-muted/20 border-t border-border">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-primary/10 text-primary border border-primary/20 mb-4 text-xs font-semibold uppercase tracking-wide">
                            Why Choose Us
                        </div>
                        <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
                            Why Gamer Plug <span className="text-primary">Solutions</span>?
                        </h2>
                        <p className="text-muted-foreground text-base max-w-xl mx-auto">
                            Our next-generation telecom routing delivers unmatched speeds and reliability.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6">
                        {[
                            {
                                icon: Zap,
                                title: 'Instant Delivery',
                                description: 'Our custom API pipelines trigger dispatch in milliseconds. Your bundles land instantly, every time.',
                                iconBg: 'bg-blue-600',
                            },
                            {
                                icon: Shield,
                                title: 'Secure Payments',
                                description: 'Fully secured wallet architecture. Every cedi is guarded by cryptographically signed ledgers.',
                                iconBg: 'bg-indigo-600',
                            },
                            {
                                icon: Clock,
                                title: '24/7 Uptime',
                                description: 'Engineered with redundant fallbacks. If one gateway fails, the system automatically hot-swaps to another.',
                                iconBg: 'bg-violet-600',
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group p-7 rounded-xl bg-white dark:bg-card border border-border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                            >
                                <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center mb-6", feature.iconBg)}>
                                    <feature.icon className="w-5 h-5 text-white" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground mb-3">{feature.title}</h3>
                                <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-14">
                        <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 tracking-tight">
                            Get Started in <span className="text-primary">3 Steps</span>
                        </h2>
                        <p className="text-muted-foreground text-base max-w-sm mx-auto">
                            Ready in under 60 seconds.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Create Account',
                                description: 'Sign up securely with your details to create your Gamer Plug profile.',
                                icon: Smartphone,
                            },
                            {
                                step: '02',
                                title: 'Fund Your Wallet',
                                description: 'Deposit credits directly via Mobile Money or card channels.',
                                icon: CreditCard,
                            },
                            {
                                step: '03',
                                title: 'Buy Data',
                                description: 'Choose your bundle and complete the purchase instantly.',
                                icon: CheckCircle2,
                            },
                        ].map((item, index) => (
                            <div key={index} className="relative group">
                                <div className="p-7 rounded-xl border border-border bg-white dark:bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                                    <div className="text-6xl font-black text-muted/30 dark:text-muted-foreground/10 absolute -top-6 -left-2 pointer-events-none select-none">
                                        {item.step}
                                    </div>
                                    <div className="relative z-10 pt-2">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors border border-primary/20">
                                            <item.icon className="w-5 h-5 text-primary" />
                                        </div>
                                        <h3 className="text-lg font-bold text-foreground mb-2">{item.title}</h3>
                                        <p className="text-muted-foreground text-sm leading-relaxed">{item.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Panel */}
            <section className="py-16 md:py-24 px-4 sm:px-6 lg:px-8">
                <div className="max-w-4xl mx-auto">
                    <div className="relative overflow-hidden rounded-2xl p-10 lg:p-16 text-center bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 shadow-xl">
                        <div className="absolute inset-0 bg-white/5 pointer-events-none" />

                        <div className="relative z-10 flex flex-col items-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-blue-100 border border-white/20 mb-6 text-xs font-semibold uppercase tracking-wide">
                                <Sparkles className="w-3.5 h-3.5" /> Get Started Free
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">
                                Ready to Buy High-Speed Data?
                            </h2>
                            <p className="text-blue-100/80 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
                                Unlock bulk pricing discounts, a secure developer API, and a fast dashboard — all in one place.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="lg" className="bg-white hover:bg-blue-50 text-blue-700 text-base px-10 h-12 rounded-lg font-bold shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5">
                                    Create Free Account
                                    <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Community Section */}
            <section className="py-16 md:py-20 px-4 sm:px-6 lg:px-8 bg-muted/40 dark:bg-muted/20 border-t border-border">
                <div className="max-w-3xl mx-auto text-center">
                    <div className="mb-8">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white dark:bg-card border border-border shadow-sm mb-5">
                            <Image src="/logo.png" alt="Gamer Plug Logo" width={32} height={32} className="object-contain" />
                        </div>
                        <h3 className="font-black text-xl text-foreground tracking-tight mb-2">
                            The Gamer Plug Community
                        </h3>
                        <p className="text-muted-foreground text-sm max-w-md mx-auto leading-relaxed">
                            Connect with thousands of gamers and resellers. Get exclusive coupon drops, network updates, and platform release notes.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-card p-6 rounded-xl border border-border shadow-sm inline-block w-full max-w-xl">
                        <WhatsAppCommunityButtons />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-10 px-4 sm:px-6 lg:px-8 border-t border-border bg-background">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-2.5">
                            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                                <Gamepad2 className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-black tracking-tight text-foreground leading-none">
                                    GAMER PLUG
                                </span>
                                <span className="text-[8px] font-bold text-primary tracking-widest uppercase mt-0.5 leading-none">
                                    SOLUTION
                                </span>
                            </div>
                        </div>
                        <p className="text-muted-foreground text-xs">
                            © {new Date().getFullYear()} Gamer Plug Solution. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
