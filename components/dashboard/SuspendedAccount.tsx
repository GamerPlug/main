'use client'

import { Ban, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useSettings } from '@/hooks/use-settings'
import { useAuth } from '@/contexts/auth-context'

export function SuspendedAccount() {
    const { settings } = useSettings()
    const { dbUser } = useAuth()

    const handleWhatsAppClick = () => {
        const cleanNumber = (num: string) => num.replace(/\+/g, '').replace(/\s/g, '')
        const rawNumber = settings.contactWhatsApp || settings.contactPhone || '233578065809'
        const PHONE_NUMBER = cleanNumber(rawNumber)
        const message = encodeURIComponent(`Hello Support, my EASYDATA account is suspended. Please help me resolve this. (User: ${dbUser?.email || ''})`)
        window.open(`https://wa.me/${PHONE_NUMBER}?text=${message}`, '_blank')
    }

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-red-200 shadow-2xl dark:border-red-900/30 overflow-hidden">
                <div className="h-2 bg-red-600 w-full" />
                <CardContent className="p-8 text-center space-y-6">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center animate-pulse">
                            <Ban className="w-10 h-10 text-red-600" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-black text-slate-900 mb-2">EASYDATA</h1>
                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            YOUR ACCOUNT IS SUSPENDED
                        </h2>
                        <p className="text-slate-600 dark:text-slate-400 font-medium">
                            CONTACT ADMIN FOR MORE INFORMATION.
                        </p>
                    </div>

                    <div className="pt-4">
                        <Button
                            onClick={handleWhatsAppClick}
                            className="w-full h-12 bg-[#25D366] hover:bg-[#20ba5a] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3"
                        >
                            <MessageSquare className="w-5 h-5 fill-white" />
                            Contact Support (WhatsApp)
                        </Button>
                    </div>

                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold pt-4 border-t border-slate-100 dark:border-slate-800">
                        EASYDATA Support System
                    </p>
                </CardContent>
            </Card>
        </div>
    )
}
