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
    Moon
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
            {/* Global Background Elements */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20 dark:opacity-10"></div>
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/10 dark:bg-primary/20 rounded-full blur-[120px] opacity-50"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-indigo-500/10 dark:bg-indigo-500/20 rounded-full blur-[100px] opacity-40"></div>
            </div>

            {/* Navigation */}
            <nav className="fixed top-0 w-full z-50 bg-white/60 dark:bg-black/60 backdrop-blur-3xl border-b border-slate-200 dark:border-white/10 shadow-sm dark:shadow-[0_4px_30px_rgba(0,0,0,0.5)] transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-20">
                        <div className="flex items-center space-x-3">
                            <div className="relative w-10 h-10 group">
                                <div className="absolute inset-0 bg-primary/20 rounded-xl blur-lg group-hover:bg-primary/40 transition-colors"></div>
                                <div className="w-full h-full rounded-xl bg-white/80 dark:bg-black/60 backdrop-blur-md border border-slate-200 dark:border-white/10 flex items-center justify-center relative z-10 transition-all">
                                    <Image src="/logo.png" alt="Logo" fill className="object-contain p-1.5" priority />
                                </div>
                            </div>
                            <span className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:to-white/70 hidden sm:block">
                                EASYDATA
                            </span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {/* Theme Toggle - Hidden on mobile, moved to MobileMenu */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 transition-colors h-10 w-10 rounded-full hidden sm:flex"
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                            >
                                {mounted && (theme === 'dark' ? (
                                    <Sun className="w-5 h-5 transition-transform" />
                                ) : (
                                    <Moon className="w-5 h-5 transition-transform" />
                                ))}
                                <span className="sr-only">Toggle theme</span>
                            </Button>

                            <div className="hidden sm:flex items-center space-x-2 sm:space-x-4">
                                <Link href="/auth/login">
                                    <Button variant="ghost" className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 font-bold transition-all h-10 px-3 sm:px-5 rounded-xl">
                                        Login
                                    </Button>
                                </Link>
                                <Link href="/auth/signup">
                                    <Button className="gradient-primary hover:glow-primary text-white font-bold h-10 px-4 sm:px-6 rounded-xl transition-all hover:scale-105 shadow-md">
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
            <section className="relative pt-28 lg:pt-48 pb-16 px-4 sm:px-6 lg:px-8 z-10 flex flex-col items-center justify-center min-h-[90vh]">
                <div className="max-w-5xl mx-auto text-center animate-slideInUp">
                    {/* Floating Badge */}
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-slate-100/80 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 mb-8 animate-float">
                        <span className="relative flex h-3 w-3 mr-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-primary shadow-[0_0_8px_rgba(225,0,255,0.8)]"></span>
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-300 font-bold tracking-wide uppercase">Ultra Fast Instant Delivery</span>
                    </div>

                    <h1 className="text-4xl sm:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-slate-900 via-slate-800 to-slate-700 dark:from-white dark:to-white/60 mb-6 drop-shadow-lg tracking-tight leading-[1.1]">
                        Buy Data Bundles
                        <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-indigo-600 dark:via-indigo-400 to-cyan-500 dark:to-cyan-400 drop-shadow-[0_0_15px_rgba(225,0,255,0.1)] dark:drop-shadow-[0_0_15px_rgba(225,0,255,0.3)]">
                            Instantly
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-10 font-medium">
                        Purchase high-speed data bundles for MTN, Telecel, AT-iShare, and AT-BigTime networks.
                        Experience the modern, reliable, and affordable way to stay connected.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <Link href="/guest/purchase">
                            <Button size="xl" className="gradient-primary hover:glow-primary text-white text-lg px-8 h-14 rounded-2xl font-bold shadow-xl hover:scale-105 transition-all">
                                Buy as Guest
                                <Zap className="ml-2 w-5 h-5 animate-pulse" />
                            </Button>
                        </Link>
                        <Link href="/auth/signup">
                            <Button size="xl" variant="outline" className="bg-slate-100/50 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-900 dark:text-white border-slate-200 dark:border-white/20 text-lg px-8 h-14 rounded-2xl font-bold transition-all shadow-md dark:shadow-lg hover:shadow-xl hover:scale-105">
                                Create Account
                            </Button>
                        </Link>
                    </div>

                    <div className="mt-10 flex justify-center">
                        <WhatsAppCTA />
                    </div>
                </div>

                {/* Network Logos */}
                <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto px-4 w-full relative z-10">
                    {[
                        { name: 'MTN', color: 'text-yellow-400', glow: 'group-hover:shadow-[0_0_30px_rgba(250,204,21,0.2)]' },
                        { name: 'Telecel', color: 'text-red-500', glow: 'group-hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]' },
                        { name: 'AT-iShare', color: 'text-orange-500', glow: 'group-hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]' },
                        { name: 'AT-BigTime', color: 'text-orange-600', glow: 'group-hover:shadow-[0_0_30px_rgba(234,88,12,0.2)]' },
                    ].map((network) => (
                        <div
                            key={network.name}
                            className={`group relative p-6 rounded-3xl bg-white/40 dark:bg-black/40 backdrop-blur-2xl border border-slate-200 dark:border-white/10 hover:border-primary/30 dark:hover:border-white/30 transition-all duration-500 hover:-translate-y-2 flex flex-col items-center justify-center shadow-sm dark:shadow-xl ${network.glow}`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity text-slate-900 dark:text-white"></div>
                            <div className="relative z-10 flex items-center justify-center mb-4 transition-transform duration-500 group-hover:scale-110">
                                <NetworkIcon network={network.name} size={64} />
                            </div>
                            <h3 className="text-lg font-black text-slate-900 dark:text-white relative z-10 tracking-wide">{network.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest relative z-10">Data Bundles</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features Section */}
            <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8 z-10 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/40 backdrop-blur-lg transition-colors">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 lg:mb-24">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight drop-shadow-md">
                            Why Choose <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-cyan-500">EASYDATA</span>
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-lg max-w-2xl mx-auto font-medium">
                            Experience the futuristic, fast, and most reliable way to purchase mobile data in Ghana
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                        {[
                            {
                                icon: Zap,
                                title: 'Lightning Delivery',
                                description: 'Your data bundle is delivered within milliseconds after purchase. Zero waiting, powered by automation.',
                                gradient: 'from-amber-400 to-orange-600',
                                glow: 'shadow-[0_10px_30px_rgba(245,158,11,0.2)] dark:shadow-[0_0_30px_rgba(245,158,11,0.3)]'
                            },
                            {
                                icon: Shield,
                                title: 'Bank-Grade Security',
                                description: 'Pay securely with mobile money, cards, or your encrypted wallet balance. Your funds are protected.',
                                gradient: 'from-emerald-400 to-cyan-500',
                                glow: 'shadow-[0_10px_30px_rgba(16,185,129,0.2)] dark:shadow-[0_0_30px_rgba(16,185,129,0.3)]'
                            },
                            {
                                icon: Clock,
                                title: 'Always Online',
                                description: 'Buy data bundles 24/7. Our cloud-native infrastructure is always up and ready to serve you.',
                                gradient: 'from-indigo-400 to-primary',
                                glow: 'shadow-[0_10px_30px_rgba(99,102,241,0.2)] dark:shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                            },
                        ].map((feature, index) => (
                            <div
                                key={index}
                                className="group p-8 rounded-3xl bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-slate-200 dark:border-white/10 hover:border-primary/20 dark:hover:border-white/20 transition-all duration-500 hover:-translate-y-2 relative overflow-hidden shadow-sm dark:shadow-xl"
                            >
                                {/* Hover Gradient Reveal */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 dark:group-hover:opacity-100 transition-opacity"></div>

                                <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 ${feature.glow}`}>
                                    <feature.icon className="w-8 h-8 text-white drop-shadow-md" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-4 relative z-10">{feature.title}</h3>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed relative z-10">{feature.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="relative py-16 md:py-24 px-4 sm:px-6 lg:px-8 z-10">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16 lg:mb-24">
                        <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">
                            Start in <span className="text-primary italic px-2">3</span> Steps
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 text-lg max-w-xl mx-auto font-medium">
                            Join the revolution of modern data purchasing.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 lg:gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Create Account',
                                description: 'Sign up securely with your email. Verification is fully automated.',
                                icon: Smartphone,
                            },
                            {
                                step: '02',
                                title: 'Fund Wallet',
                                description: 'Instantly top up using your preferred mobile money network or card.',
                                icon: CreditCard,
                            },
                            {
                                step: '03',
                                title: 'Get Instant Data',
                                description: 'Select your package and watch the data arrive before you blink.',
                                icon: CheckCircle2,
                            },
                        ].map((item, index) => (
                            <div key={index} className="relative group p-8 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.05] transition-all shadow-sm dark:shadow-none">
                                <div className="text-7xl lg:text-8xl font-black text-slate-200 dark:text-white/5 absolute -top-8 -left-4 group-hover:text-primary/10 transition-colors pointer-events-none select-none">
                                    {item.step}
                                </div>
                                <div className="relative z-10 pt-4">
                                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-white/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors border border-slate-200 dark:border-white/10 group-hover:border-primary/50">
                                        <item.icon className="w-7 h-7 text-slate-600 dark:text-white group-hover:text-primary transition-colors" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">{item.title}</h3>
                                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">{item.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative py-12 md:py-20 px-4 sm:px-6 lg:px-8 z-10">
                <div className="max-w-5xl mx-auto">
                    <div className="relative overflow-hidden rounded-[2.5rem] p-10 lg:p-16 text-center border border-slate-200 dark:border-white/20 shadow-xl dark:shadow-[0_0_50px_rgba(225,0,255,0.2)] group transition-all">
                        {/* Dynamic Background */}
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-primary to-cyan-600 dark:from-indigo-900 dark:via-primary/80 dark:to-cyan-900 opacity-90 transition-transform duration-1000 group-hover:scale-105"></div>
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-30 mix-blend-overlay"></div>

                        <div className="relative z-10 flex flex-col items-center">
                            <h2 className="text-4xl md:text-5xl font-black text-white mb-6 drop-shadow-lg tracking-tight">
                                Ready for the Future?
                            </h2>
                            <p className="text-white/90 dark:text-white/80 text-lg md:text-xl max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
                                Join thousands of progressive Ghanaians who upgrade their connectivity with EASYDATA.
                            </p>
                            <Link href="/auth/signup">
                                <Button size="xl" className="bg-white hover:bg-slate-100 text-primary text-lg px-10 h-16 rounded-2xl font-black shadow-2xl hover:shadow-[0_0_40px_rgba(255,255,255,0.5)] transition-all hover:scale-105 flex items-center">
                                    Create Free Account
                                    <ArrowRight className="ml-3 w-6 h-6" />
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Community Section */}
            <section className="relative py-12 md:py-16 px-4 sm:px-6 lg:px-8 z-10 bg-slate-50 dark:bg-black/50 border-t border-slate-200 dark:border-white/5 backdrop-blur-md transition-colors">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="mb-10">
                        <div className="inline-flex items-center justify-center p-3 bg-white dark:glass-card rounded-2xl border border-slate-200 dark:border-white/10 mb-6 shadow-sm">
                            <Image src="/logo.png" alt="Logo" width={48} height={48} className="object-contain" />
                        </div>
                        <h3 className="font-black text-2xl text-slate-900 dark:text-white tracking-tight mb-4">EASYDATA</h3>
                        <p className="text-slate-600 dark:text-slate-400 text-base max-w-lg mx-auto font-medium">
                            Join our vibrant online community. Stay updated on the latest network offers, platform updates, and flash sales.
                        </p>
                    </div>
                    {/* The community buttons component will need to be glassmorphic inside, assuming we might need to style it or wrap it if it has hardcoded styles */}
                    <div className="bg-white/60 dark:glass-card p-6 rounded-3xl border border-slate-200 dark:border-white/10 inline-block w-full max-w-2xl shadow-sm">
                        <WhatsAppCommunityButtons />
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black z-10 transition-colors">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
                                <Wifi className="w-5 h-5 text-white drop-shadow-md" />
                            </div>
                            <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-white/60 tracking-tight">EASYDATA</span>
                        </div>
                        <p className="text-slate-500 font-bold text-sm tracking-wide">
                            © {new Date().getFullYear()} EASYDATA. All rights reserved.
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
