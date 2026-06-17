'use client'

import { useEffect, useState } from 'react'
import { X, Download, Share, Plus, Smartphone } from 'lucide-react'

const DISMISS_KEY = 'gp-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
    const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
    const [show, setShow] = useState(false)
    const [isIOS, setIsIOS] = useState(false)
    const [showIOSHelp, setShowIOSHelp] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined') return

        const standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true
        if (standalone) return // already installed

        try {
            if (localStorage.getItem(DISMISS_KEY)) return
        } catch {
            /* private mode */
        }

        const ua = window.navigator.userAgent
        const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream
        setIsIOS(ios)

        if (ios) {
            const t = setTimeout(() => setShow(true), 4000)
            return () => clearTimeout(t)
        }

        const handler = (e: Event) => {
            e.preventDefault()
            setDeferred(e as BeforeInstallPromptEvent)
            setShow(true)
        }
        const installed = () => {
            setShow(false)
            setDeferred(null)
        }
        window.addEventListener('beforeinstallprompt', handler)
        window.addEventListener('appinstalled', installed)
        return () => {
            window.removeEventListener('beforeinstallprompt', handler)
            window.removeEventListener('appinstalled', installed)
        }
    }, [])

    const dismiss = () => {
        setShow(false)
        setShowIOSHelp(false)
        try {
            localStorage.setItem(DISMISS_KEY, '1')
        } catch {
            /* ignore */
        }
    }

    const install = async () => {
        if (isIOS) {
            setShowIOSHelp(true)
            return
        }
        if (!deferred) return
        await deferred.prompt()
        const { outcome } = await deferred.userChoice
        if (outcome === 'accepted') setShow(false)
        setDeferred(null)
    }

    if (!show) return null

    return (
        <>
            {/* Install banner */}
            <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[380px] z-[60] animate-in slide-in-from-bottom-4 fade-in duration-500">
                <div className="rounded-2xl border border-white/10 bg-[#0e0e16]/95 backdrop-blur-xl shadow-2xl p-4 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-white leading-tight">Install Gamer Plug</p>
                        <p className="text-xs text-white/60 font-medium mt-0.5">
                            {isIOS
                                ? 'Add to your Home Screen for instant access & push alerts.'
                                : 'Get the app for instant access, offline support & push notifications.'}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={install}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 transition"
                            >
                                <Download className="w-3.5 h-3.5" />
                                {isIOS ? 'How to install' : 'Install'}
                            </button>
                            <button
                                onClick={dismiss}
                                className="rounded-lg px-3 py-1.5 text-xs font-bold text-white/50 hover:text-white/80 transition"
                            >
                                Not now
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={dismiss}
                        className="text-white/40 hover:text-white/70 transition flex-shrink-0"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* iOS instructions modal */}
            {showIOSHelp && (
                <div
                    className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                    onClick={() => setShowIOSHelp(false)}
                >
                    <div
                        className="w-full sm:max-w-sm rounded-2xl border border-white/10 bg-[#0e0e16] p-6 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-black text-white mb-4">Install on iPhone / iPad</h3>
                        <ol className="space-y-4">
                            <li className="flex items-center gap-3 text-sm text-white/80 font-medium">
                                <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-black text-xs flex-shrink-0">1</span>
                                <span className="flex items-center gap-1.5">Tap the <Share className="w-4 h-4 inline text-primary" /> Share button in Safari</span>
                            </li>
                            <li className="flex items-center gap-3 text-sm text-white/80 font-medium">
                                <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-black text-xs flex-shrink-0">2</span>
                                <span className="flex items-center gap-1.5">Choose <Plus className="w-4 h-4 inline text-primary" /> &quot;Add to Home Screen&quot;</span>
                            </li>
                            <li className="flex items-center gap-3 text-sm text-white/80 font-medium">
                                <span className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center font-black text-xs flex-shrink-0">3</span>
                                <span>Open Gamer Plug from your Home Screen and enable notifications in Settings.</span>
                            </li>
                        </ol>
                        <button
                            onClick={dismiss}
                            className="mt-6 w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:opacity-90 transition"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
