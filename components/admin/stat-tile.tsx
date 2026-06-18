'use client'

import type { LucideIcon } from 'lucide-react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useCountUp } from '@/hooks/use-count-up'
import { Sparkline } from '@/components/admin/charts'

export type Tone = 'blue' | 'violet' | 'emerald' | 'amber' | 'cyan' | 'rose' | 'indigo' | 'teal'

const TONES: Record<Tone, { chip: string; icon: string; spark: string; glow: string }> = {
    blue:    { chip: 'bg-blue-50 dark:bg-blue-500/10',       icon: 'text-blue-600 dark:text-blue-400',       spark: 'text-blue-500',    glow: 'bg-blue-500/20' },
    violet:  { chip: 'bg-violet-50 dark:bg-violet-500/10',   icon: 'text-violet-600 dark:text-violet-400',   spark: 'text-violet-500',  glow: 'bg-violet-500/20' },
    emerald: { chip: 'bg-emerald-50 dark:bg-emerald-500/10', icon: 'text-emerald-600 dark:text-emerald-400', spark: 'text-emerald-500', glow: 'bg-emerald-500/20' },
    amber:   { chip: 'bg-amber-50 dark:bg-amber-500/10',     icon: 'text-amber-600 dark:text-amber-400',     spark: 'text-amber-500',   glow: 'bg-amber-500/20' },
    cyan:    { chip: 'bg-cyan-50 dark:bg-cyan-500/10',       icon: 'text-cyan-600 dark:text-cyan-400',       spark: 'text-cyan-500',    glow: 'bg-cyan-500/20' },
    rose:    { chip: 'bg-rose-50 dark:bg-rose-500/10',       icon: 'text-rose-600 dark:text-rose-400',       spark: 'text-rose-500',    glow: 'bg-rose-500/20' },
    indigo:  { chip: 'bg-indigo-50 dark:bg-indigo-500/10',   icon: 'text-indigo-600 dark:text-indigo-400',   spark: 'text-indigo-500',  glow: 'bg-indigo-500/20' },
    teal:    { chip: 'bg-teal-50 dark:bg-teal-500/10',       icon: 'text-teal-600 dark:text-teal-400',       spark: 'text-teal-500',    glow: 'bg-teal-500/20' },
}

interface StatTileProps {
    label: string
    value: number
    icon: LucideIcon
    tone: Tone
    format?: 'number' | 'currency' | 'percent'
    decimals?: number
    deltaPct?: number
    sublabel?: string
    sparkline?: number[]
}

export function StatTile({
    label,
    value,
    icon: Icon,
    tone,
    format = 'number',
    decimals = 0,
    deltaPct,
    sublabel,
    sparkline,
}: StatTileProps) {
    const animated = useCountUp(value)
    const t = TONES[tone]

    const formatted =
        format === 'currency'
            ? formatCurrency(animated)
            : format === 'percent'
                ? `${animated.toFixed(decimals)}%`
                : animated.toLocaleString('en-US', { maximumFractionDigits: decimals })

    const hasDelta = typeof deltaPct === 'number' && Number.isFinite(deltaPct)
    const up = (deltaPct ?? 0) >= 0

    return (
        <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
            {/* corner glow — the on-brand "noise" */}
            <div className={cn('glow-orb -right-6 -top-8 h-24 w-24 opacity-0 transition-opacity duration-300 group-hover:opacity-60', t.glow)} />

            <div className="relative flex items-start justify-between">
                <p className="text-sm font-medium text-muted-foreground">{label}</p>
                <div className={cn('flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl', t.chip)}>
                    <Icon className={cn('h-5 w-5', t.icon)} />
                </div>
            </div>

            <p className="relative mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                {formatted}
            </p>

            <div className="relative mt-1.5 flex items-center gap-2">
                {hasDelta && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold',
                            up ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        )}
                    >
                        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {Math.abs(deltaPct!)}%
                    </span>
                )}
                {sublabel && <span className="text-xs text-muted-foreground">{sublabel}</span>}
            </div>

            {sparkline && sparkline.length > 1 && (
                <div className={cn('relative mt-3', t.spark)}>
                    <Sparkline data={sparkline} />
                </div>
            )}
        </div>
    )
}
