'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker (public/sw.js) once the page has loaded.
 * Safe no-op on browsers without service worker support.
 */
export function ServiceWorkerRegister() {
    useEffect(() => {
        if (typeof window === 'undefined') return
        if (!('serviceWorker' in navigator)) return

        const register = () => {
            navigator.serviceWorker
                .register('/sw.js')
                .catch((err) => console.error('Service worker registration failed:', err))
        }

        if (document.readyState === 'complete') {
            register()
        } else {
            window.addEventListener('load', register, { once: true })
            return () => window.removeEventListener('load', register)
        }
    }, [])

    return null
}
