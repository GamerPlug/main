'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Menu, X, Sun, Moon, LogIn, Zap, CheckCircle2, Shield, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'

interface MobileMenuProps {
    className?: string
}

export function MobileMenu({ className }: MobileMenuProps) {
    const [isOpen, setIsOpen] = useState(false)
    const { theme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        return () => {
            document.body.style.overflow = 'unset'
        }
    }, [isOpen])

    return (
        <div className={cn("lg:hidden", className)}>
            <Button
                variant="ghost"
                size="icon"
                className="text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-white hover:bg-primary/5 dark:hover:bg-white/10 transition-colors h-10 w-10 rounded-xl"
                onClick={() => setIsOpen(true)}
            >
                <Menu className="w-6 h-6" />
                <span className="sr-only">Open menu</span>
            </Button>

            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-[100] bg-black/60 backdrop-blur-md transition-opacity duration-300 ease-in-out lg:hidden",
                    isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={() => setIsOpen(false)}
            />

            {/* Menu Content */}
            <div
                className={cn(
                    "fixed top-0 right-0 z-[101] h-screen w-[280px] sm:w-[320px] bg-white dark:bg-black border-l border-slate-200 dark:border-white/10 shadow-2xl transition-transform duration-300 ease-in-out lg:hidden flex flex-col",
                    isOpen ? "translate-x-0" : "translate-x-full"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-white/5">
                    <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Menu</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-slate-900 dark:hover:text-white h-10 w-10 rounded-xl"
                        onClick={() => setIsOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Navigation Links */}
                <div className="flex-1 overflow-y-auto py-8 px-6 space-y-6">
                    <div className="space-y-1">
                        <Link 
                            href="/guest/purchase" 
                            className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 text-primary text-base font-bold transition-all hover:bg-primary/10"
                            onClick={() => setIsOpen(false)}
                        >
                            <Zap className="w-5 h-5" />
                            Buy Data
                        </Link>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Account</p>
                        <div className="space-y-2">
                            <Link 
                                href="/auth/login" 
                                className="flex items-center gap-3 p-4 rounded-2xl text-slate-600 dark:text-slate-300 text-base font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                                onClick={() => setIsOpen(false)}
                            >
                                <LogIn className="w-5 h-5" />
                                Login
                            </Link>
                            <Link 
                                href="/auth/signup" 
                                className="flex items-center gap-3 p-4 rounded-2xl text-slate-600 dark:text-slate-300 text-base font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                                onClick={() => setIsOpen(false)}
                            >
                                <CheckCircle2 className="w-5 h-5" />
                                Get Started
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-white/5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Settings</p>
                        <Button
                            variant="ghost"
                            className="w-full justify-start gap-3 p-4 h-auto rounded-2xl text-slate-600 dark:text-slate-300 text-base font-bold hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                            onClick={() => {
                                setTheme(theme === 'dark' ? 'light' : 'dark')
                                // Optional: Keep menu open or close after theme change
                            }}
                        >
                            {mounted && (theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />)}
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </Button>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3 text-slate-400">
                        <Shield className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Secure Connection</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
