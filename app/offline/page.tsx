import { WifiOff } from 'lucide-react'

export const metadata = {
    title: 'Offline — Gamer Plug Solution',
}

// Pure server component (no client JS needed) so it renders from the SW cache
// even when the network — and chunk loading — is unavailable.
export default function OfflinePage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a10] text-white px-6 text-center">
            <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                <WifiOff className="w-10 h-10 text-white/70" />
            </div>
            <h1 className="text-2xl font-black tracking-tight mb-2">You&apos;re offline</h1>
            <p className="text-white/60 max-w-sm font-medium">
                Gamer Plug needs an internet connection to load your dashboard. Check your
                connection and try again.
            </p>
            <p className="text-white/30 text-xs mt-8 uppercase tracking-widest font-bold">
                Gamer Plug Solution
            </p>
        </div>
    )
}
