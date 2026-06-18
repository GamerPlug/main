'use client'

import { useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Sparkline — tiny decorative line for stat tiles. Color = currentColor */
/* ------------------------------------------------------------------ */
export function Sparkline({
    data,
    className,
    strokeWidth = 2,
}: {
    data: number[]
    className?: string
    strokeWidth?: number
}) {
    const id = useId()
    const w = 100
    const h = 32

    const series = data && data.length > 1 ? data : [0, 0]
    const max = Math.max(...series)
    const min = Math.min(...series)
    const range = max - min || 1

    const pts = series.map((v, i) => {
        const x = (i / (series.length - 1)) * w
        const y = h - ((v - min) / range) * (h - 4) - 2
        return [x, y] as const
    })

    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const area = `${line} L${w},${h} L0,${h} Z`

    return (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn('w-full h-8', className)} aria-hidden>
            <defs>
                <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#spark-${id})`} />
            <path
                d={line}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    )
}

/* ------------------------------------------------------------------ */
/* AreaChart — interactive gradient area chart with hover crosshair     */
/* ------------------------------------------------------------------ */
export interface AreaPoint {
    label: string
    value: number
}

export function AreaChart({
    data,
    formatValue = (n) => n.toLocaleString(),
    height = 200,
    accentClass = 'text-primary',
}: {
    data: AreaPoint[]
    formatValue?: (n: number) => string
    height?: number
    accentClass?: string
}) {
    const id = useId()
    const containerRef = useRef<HTMLDivElement>(null)
    const [hover, setHover] = useState<number | null>(null)

    const W = 100
    const H = 100
    const pad = 6

    const values = data.length ? data.map((d) => d.value) : [0]
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const range = max - min || 1

    const xOf = (i: number) => data.length > 1 ? (i / (data.length - 1)) * W : W / 2
    const yOf = (v: number) => H - pad - ((v - min) / range) * (H - pad * 2)

    const pts = data.map((d, i) => [xOf(i), yOf(d.value)] as const)
    const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
    const area = pts.length ? `${line} L${W},${H} L0,${H} Z` : ''

    const onMove = (e: React.MouseEvent) => {
        const el = containerRef.current
        if (!el || data.length === 0) return
        const rect = el.getBoundingClientRect()
        const frac = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
        setHover(Math.round(frac * (data.length - 1)))
    }

    const active = hover != null ? data[hover] : null

    return (
        <div
            ref={containerRef}
            className={cn('relative w-full', accentClass)}
            style={{ height }}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
        >
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
                <defs>
                    <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="currentColor" stopOpacity="0.30" />
                        <stop offset="100%" stopColor="currentColor" stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* horizontal gridlines */}
                {[0.25, 0.5, 0.75].map((g) => (
                    <line
                        key={g}
                        x1="0"
                        x2={W}
                        y1={H * g}
                        y2={H * g}
                        stroke="currentColor"
                        strokeOpacity="0.08"
                        strokeWidth="0.5"
                        vectorEffect="non-scaling-stroke"
                    />
                ))}

                {area && <path d={area} fill={`url(#area-${id})`} />}
                {line && (
                    <path
                        d={line}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                    />
                )}

                {active && hover != null && (
                    <>
                        <line
                            x1={xOf(hover)}
                            x2={xOf(hover)}
                            y1="0"
                            y2={H}
                            stroke="currentColor"
                            strokeOpacity="0.35"
                            strokeWidth="1"
                            strokeDasharray="2 2"
                            vectorEffect="non-scaling-stroke"
                        />
                        <circle cx={xOf(hover)} cy={yOf(active.value)} r="3.5" fill="currentColor" vectorEffect="non-scaling-stroke" />
                        <circle cx={xOf(hover)} cy={yOf(active.value)} r="6" fill="currentColor" fillOpacity="0.18" vectorEffect="non-scaling-stroke" />
                    </>
                )}
            </svg>

            {/* tooltip */}
            {active && hover != null && (
                <div
                    className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-1"
                    style={{ left: `${(hover / Math.max(data.length - 1, 1)) * 100}%` }}
                >
                    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{active.label}</p>
                        <p className="text-sm font-bold text-foreground">{formatValue(active.value)}</p>
                    </div>
                </div>
            )}

            {/* x-axis labels */}
            <div className="mt-2 flex justify-between text-[10px] font-medium text-muted-foreground">
                {data.map((d, i) => (
                    <span key={i} className={cn(data.length > 7 && i % 2 !== 0 && 'hidden sm:inline')}>{d.label}</span>
                ))}
            </div>
        </div>
    )
}
