'use client'

import { CreditCard, MessageSquare, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

import { useAuth } from '@/contexts/auth-context'
import { useSettings } from '@/hooks/use-settings'

interface SettlementOverlayProps {
    amount: number
}

export function SettlementOverlay({ amount }: SettlementOverlayProps) {
    const { refreshUser, dbUser } = useAuth()
    const { settings } = useSettings()

    const handleWhatsAppClick = () => {
        const cleanNumber = (num: string) => num.replace(/\+/g, '').replace(/\s/g, '')
        const rawNumber = settings.contactWhatsApp || settings.contactPhone || '233578065809'
        const PHONE_NUMBER = cleanNumber(rawNumber)
        const message = encodeURIComponent(`Hello Support, I have a settlement of GHS ${Math.abs(amount).toFixed(2)} to clear on my GAMER PLUG account. Please verify my payment and reactivate my account. (User: ${dbUser?.email || ''})`)
        window.open(`https://wa.me/${PHONE_NUMBER}?text=${message}`, '_blank')
    }

    const formattedAmount = new Intl.NumberFormat('en-GH', {
        style: 'currency',
        currency: 'GHS',
    }).format(Math.abs(amount))

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <Card className="max-w-md w-full border-primary/20 shadow-2xl overflow-hidden bg-slate-900/90 text-white border-2 border-indigo-500/30">
                <div className="h-2 bg-gradient-to-r from-indigo-500 via-primary to-secondary w-full" />
                <CardContent className="p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center border-2 border-indigo-500/40 animate-pulse">
                            <CreditCard className="w-10 h-10 text-indigo-400" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-cyan-400 font-orbitron uppercase">
                            GAMER PLUG
                        </h1>
                        <h2 className="text-xl font-bold uppercase tracking-tight text-slate-100">
                            Daily Settlement Required
                        </h2>
                        <div className="py-4 px-6 bg-slate-950/50 rounded-2xl border border-white/5 space-y-1">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Amount to Settle</p>
                            <p className="text-4xl font-black text-indigo-400">
                                {formattedAmount}
                            </p>
                        </div>
                        <div className="flex items-start gap-3 text-left p-4 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                            <AlertCircle className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                            <p className="text-sm text-slate-300 leading-relaxed italic">
                                Your account has been automatically deactivated for settlement. Please settle the outstanding balance to continue trading.
                            </p>
                        </div>
                    </div>

                    <div className="pt-2 space-y-3">
                        <Button
                            onClick={handleWhatsAppClick}
                            className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all flex items-center justify-center gap-3 border border-indigo-400/30 group"
                        >
                            <MessageSquare className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" />
                            Notify Admin (WhatsApp)
                        </Button>

                        <Button 
                            variant="outline"
                            onClick={() => refreshUser?.()}
                            className="w-full h-12 border-white/10 text-slate-300 hover:bg-white/5 rounded-xl text-xs font-bold uppercase tracking-widest"
                        >
                            Refresh Status
                        </Button>
                    </div>

                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold pt-4 border-t border-white/5 font-orbitron">
                        GAMER PLUG Settlement Enforcement System
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
