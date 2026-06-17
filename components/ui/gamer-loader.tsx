'use client'

import { cn } from '@/lib/utils'

interface GamerLoaderProps {
    /** Full-viewport overlay (used by route loading.tsx). Otherwise inline/centered. */
    fullScreen?: boolean
    label?: string
    className?: string
}

/**
 * Branded loading state for Gamer Plug. Pure CSS (no images/JS work) so it
 * paints instantly. Concentric energy rings + pulsing "GP" core.
 */
export function GamerLoader({ fullScreen = false, label = 'Loading', className }: GamerLoaderProps) {
    const core = (
        <div className={cn('flex flex-col items-center justify-center gap-5', className)}>
            <div className="relative w-16 h-16">
                {/* Outer ring */}
                <span className="absolute inset-0 rounded-2xl border-2 border-primary/30" />
                {/* Spinning arc */}
                <span className="absolute inset-0 rounded-2xl border-2 border-transparent border-t-primary border-r-primary animate-spin [animation-duration:0.8s]" />
                {/* Inner counter-spin arc */}
                <span className="absolute inset-2 rounded-xl border-2 border-transparent border-b-indigo-500 border-l-indigo-500 animate-spin [animation-duration:1.2s] [animation-direction:reverse]" />
                {/* Pulsing GP core */}
                <span className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black tracking-tighter bg-gradient-to-br from-primary to-indigo-400 bg-clip-text text-transparent animate-pulse">
                        GP
                    </span>
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                <p className="text-[11px] font-black uppercase tracking-[0.25em] text-foreground/50">{label}</p>
                <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1 h-1 rounded-full bg-primary animate-bounce" />
                </span>
            </div>
        </div>
    )

    if (fullScreen) {
        return (
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background/80 backdrop-blur-sm">
                {core}
            </div>
        )
    }

    return <div className="w-full flex items-center justify-center py-20">{core}</div>
}
