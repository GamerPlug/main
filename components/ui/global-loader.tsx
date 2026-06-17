'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { GamerLoader } from './gamer-loader'

const MIN_VISIBLE = 500 // brief, guaranteed-visible loader
const SAFETY_MAX = 6000 // hard cap so the overlay can never get stuck

/**
 * App-wide loading overlay. Because the initial state is `active`, it is
 * server-rendered into the HTML and therefore visible on the very first paint
 * of a hard refresh — then hidden after hydration. It also shows on every
 * client navigation (link click + committed route change).
 */
export function GlobalLoader() {
    const pathname = usePathname()
    const [active, setActive] = useState(true)
    const safety = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Show briefly on initial load and after every committed route change.
    useEffect(() => {
        setActive(true)
        if (safety.current) { clearTimeout(safety.current); safety.current = null }
        const t = setTimeout(() => setActive(false), MIN_VISIBLE)
        return () => clearTimeout(t)
    }, [pathname])

    // Show immediately when an internal navigation starts (link click), so the
    // loader is visible during the transition, not just after it commits.
    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            const a = (e.target as HTMLElement)?.closest('a')
            if (!a) return
            const href = a.getAttribute('href')
            if (!href || href.startsWith('#') || a.target === '_blank' || a.hasAttribute('download')) return
            try {
                const url = new URL(href, window.location.href)
                if (url.origin !== window.location.origin) return
                if (url.pathname === window.location.pathname && url.search === window.location.search) return
                setActive(true)
                if (safety.current) clearTimeout(safety.current)
                safety.current = setTimeout(() => setActive(false), SAFETY_MAX)
            } catch {
                /* invalid href */
            }
        }
        document.addEventListener('click', onClick, true)
        return () => {
            document.removeEventListener('click', onClick, true)
            if (safety.current) clearTimeout(safety.current)
        }
    }, [])

    if (!active) return null
    return <GamerLoader fullScreen />
}
