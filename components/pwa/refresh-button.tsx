'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const POS_KEY = 'gp-refresh-fab-pos'
const SIZE = 48
const MARGIN = 12
const DRAG_THRESHOLD = 6

/**
 * Draggable floating button that performs a true hard refresh:
 * clears all caches + updates the service worker, then reloads.
 * Position is remembered across sessions.
 */
export function RefreshButton() {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
    const [refreshing, setRefreshing] = useState(false)
    const dragging = useRef(false)
    const moved = useRef(false)
    const start = useRef({ x: 0, y: 0 })
    const offset = useRef({ x: 0, y: 0 })
    const btnRef = useRef<HTMLButtonElement>(null)

    const clamp = (x: number, y: number) => ({
        x: Math.min(Math.max(MARGIN, x), window.innerWidth - SIZE - MARGIN),
        y: Math.min(Math.max(MARGIN, y), window.innerHeight - SIZE - MARGIN),
    })

    useEffect(() => {
        let initial = { x: window.innerWidth - SIZE - MARGIN, y: Math.round(window.innerHeight * 0.45) }
        try {
            const saved = localStorage.getItem(POS_KEY)
            if (saved) {
                const p = JSON.parse(saved)
                if (typeof p?.x === 'number' && typeof p?.y === 'number') initial = p
            }
        } catch {
            /* ignore */
        }
        setPos(clamp(initial.x, initial.y))

        const onResize = () => setPos((p) => (p ? clamp(p.x, p.y) : p))
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    const onPointerDown = (e: React.PointerEvent) => {
        if (!btnRef.current) return
        dragging.current = true
        moved.current = false
        start.current = { x: e.clientX, y: e.clientY }
        const rect = btnRef.current.getBoundingClientRect()
        offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        try { btnRef.current.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }

    const onPointerMove = (e: React.PointerEvent) => {
        if (!dragging.current) return
        const dist = Math.abs(e.clientX - start.current.x) + Math.abs(e.clientY - start.current.y)
        if (dist > DRAG_THRESHOLD) moved.current = true
        setPos(clamp(e.clientX - offset.current.x, e.clientY - offset.current.y))
    }

    const onPointerUp = (e: React.PointerEvent) => {
        if (!dragging.current) return
        dragging.current = false
        try { btnRef.current?.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
        setPos((p) => {
            if (p) {
                try { localStorage.setItem(POS_KEY, JSON.stringify(p)) } catch { /* ignore */ }
            }
            return p
        })
    }

    const hardRefresh = useCallback(async () => {
        if (moved.current) return // it was a drag, not a tap
        setRefreshing(true)
        try {
            if ('caches' in window) {
                const keys = await caches.keys()
                await Promise.all(keys.map((k) => caches.delete(k)))
            }
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations()
                await Promise.all(regs.map((r) => r.update()))
            }
        } catch {
            /* best-effort */
        }
        window.location.reload()
    }, [])

    if (!pos) return null

    return (
        <button
            ref={btnRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onClick={hardRefresh}
            aria-label="Hard refresh"
            title="Hard refresh (drag to move)"
            style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
            className={cn(
                'fixed z-[55] flex items-center justify-center rounded-full shadow-xl transition-transform active:scale-90',
                'bg-gradient-to-br from-primary to-indigo-600 text-white border border-white/20',
                'shadow-[0_4px_20px_rgba(225,0,255,0.35)] hover:scale-105 cursor-grab active:cursor-grabbing',
            )}
        >
            <span style={{ width: SIZE, height: SIZE }} className="flex items-center justify-center">
                <RefreshCw className={cn('w-5 h-5 drop-shadow', refreshing && 'animate-spin')} />
            </span>
        </button>
    )
}
