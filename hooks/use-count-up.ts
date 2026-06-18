'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animate a number from its previous value up to `value` using an ease-out
 * curve. Re-runs whenever `value` changes, so it works with live data.
 * Respects prefers-reduced-motion by snapping straight to the value.
 */
export function useCountUp(value: number, durationMs = 900): number {
    const [display, setDisplay] = useState(value)
    const fromRef = useRef(value)
    const rafRef = useRef<number>()

    useEffect(() => {
        const reduce = typeof window !== 'undefined'
            && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

        const from = fromRef.current
        const to = value

        if (reduce || from === to) {
            setDisplay(to)
            fromRef.current = to
            return
        }

        const start = performance.now()
        const tick = (now: number) => {
            const t = Math.min((now - start) / durationMs, 1)
            const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
            setDisplay(from + (to - from) * eased)
            if (t < 1) {
                rafRef.current = requestAnimationFrame(tick)
            } else {
                fromRef.current = to
            }
        }

        rafRef.current = requestAnimationFrame(tick)
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            fromRef.current = to
        }
    }, [value, durationMs])

    return display
}
