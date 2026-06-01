'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SystemAnnouncementModal } from '@/components/system-announcement-modal'
import { useAuth } from '@/contexts/auth-context'
import { UIProvider } from '@/contexts/ui-context'
import { DashboardSidebar } from '@/components/dashboard/sidebar'
import { DashboardHeader } from '@/components/dashboard/header'
import { Skeleton } from '@/components/ui/skeleton'
import { WhatsAppButton } from '@/components/whatsapp-button'
import { SuspendedAccount } from '@/components/dashboard/SuspendedAccount'
import { SettlementOverlay } from '@/components/dashboard/SettlementOverlay'


export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, dbUser, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!isLoading && !user) {
            router.push('/')
        }
    }, [user, isLoading, router])

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="space-y-4 w-full max-w-md p-8">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-8 w-1/2" />
                </div>
            </div>
        )
    }

    if (!user) {
        return null
    }

    const isSuspended = dbUser?.status === 'suspended' && (dbUser?.role === 'agent' || dbUser?.role === 'dealer')

    if (isSuspended) {
        return (
            <UIProvider>
                <div className="min-h-screen bg-background text-foreground relative flex font-sans selection:bg-primary/30 transition-colors duration-300">
                    <div className="fixed inset-0 z-0 pointer-events-none">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 dark:opacity-20"></div>
                        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-40"></div>
                        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[100px] opacity-30"></div>
                    </div>
                    <DashboardSidebar />
                    <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-[300px] relative z-10 w-full overflow-hidden">
                        <DashboardHeader />
                        <main className="p-4 lg:p-6 lg:py-8 max-w-7xl mx-auto w-full flex-1 overflow-x-hidden animate-fadeIn">
                            <SuspendedAccount />
                        </main>
                    </div>
                    <WhatsAppButton />
                </div>
            </UIProvider>
        )
    }

    if (dbUser?.requires_settlement) {
        return (
            <UIProvider>
                <div className="min-h-screen bg-background text-foreground relative flex font-sans selection:bg-primary/30 transition-colors duration-300">
                    <div className="fixed inset-0 z-0 pointer-events-none">
                        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 dark:opacity-20"></div>
                        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-40"></div>
                        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[100px] opacity-30"></div>
                    </div>
                    <DashboardSidebar />
                    <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-[300px] relative z-10 w-full overflow-hidden">
                        <DashboardHeader />
                        <main className="p-4 lg:p-6 lg:py-8 max-w-7xl mx-auto w-full flex-1 overflow-x-hidden animate-fadeIn">
                            {children}
                        </main>
                    </div>
                    <SettlementOverlay amount={(Array.isArray(dbUser.wallets) ? dbUser.wallets[0]?.balance : (dbUser.wallets as any)?.balance) || 0} />
                    <WhatsAppButton />
                </div>
            </UIProvider>
        )
    }

    return (
        <UIProvider>
            <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-900 dark:text-white relative flex font-sans selection:bg-primary/30 transition-colors duration-300">
                <div className="fixed inset-0 z-0 pointer-events-none">
                    <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-5 dark:opacity-20"></div>
                    <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-40"></div>
                    <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/3 w-[600px] h-[600px] bg-indigo-500/20 rounded-full blur-[100px] opacity-30"></div>
                </div>
                <SystemAnnouncementModal />
                <DashboardSidebar />
                <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 lg:pl-[300px] relative z-10 w-full overflow-hidden">
                    <DashboardHeader />
                    <main className="p-4 lg:p-6 lg:py-8 max-w-7xl mx-auto w-full flex-1 overflow-x-hidden animate-fadeIn">
                        {children}
                    </main>
                </div>
                <WhatsAppButton />
            </div>
        </UIProvider>
    )
}
