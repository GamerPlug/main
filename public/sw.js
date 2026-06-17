/* Gamer Plug Solution — Service Worker
 * Hand-rolled: web push + notification click routing + offline shell +
 * cache-first for immutable static assets (big PWA speed win on repeat loads).
 *
 * NEVER caches API / auth / HTML data responses — only content-hashed static
 * assets and a couple of stable icons — so wallet/order data is never stale.
 */
const SHELL_CACHE = 'gp-shell-v3'
const STATIC_CACHE = 'gp-static-v3'
const ALLOWED_CACHES = [SHELL_CACHE, STATIC_CACHE]
const APP_SHELL = ['/offline']

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}),
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => !ALLOWED_CACHES.includes(k)).map((k) => caches.delete(k))),
        ),
    )
    self.clients.claim()
})

// --- Web Push ---
self.addEventListener('push', (event) => {
    let data = {}
    try {
        data = event.data ? event.data.json() : {}
    } catch (e) {
        data = { title: 'Gamer Plug', body: event.data ? event.data.text() : '' }
    }

    const title = data.title || 'Gamer Plug Solution'
    const options = {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        data: { url: data.url || '/dashboard/notifications' },
        tag: data.type || 'gp-notification',
        renotify: true,
        vibrate: data.priority === 'high' ? [100, 50, 100, 50, 100] : [80, 40, 80],
    }
    event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
    event.notification.close()
    const url =
        (event.notification.data && event.notification.data.url) || '/dashboard/notifications'

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                for (const client of clientList) {
                    if ('focus' in client) {
                        if ('navigate' in client) {
                            try { client.navigate(url) } catch (e) { /* cross-origin guard */ }
                        }
                        return client.focus()
                    }
                }
                if (self.clients.openWindow) return self.clients.openWindow(url)
            }),
    )
})

// --- Fetch strategy ---
function isImmutableStatic(url) {
    return url.pathname.startsWith('/_next/static/')
}
function isStableAsset(url) {
    return (
        url.pathname.startsWith('/icons/') ||
        url.pathname === '/logo.png' ||
        url.pathname === '/manifest.webmanifest'
    )
}

self.addEventListener('fetch', (event) => {
    const req = event.request
    if (req.method !== 'GET') return

    const url = new URL(req.url)
    const sameOrigin = url.origin === self.location.origin

    // Page navigations: network-first, fall back to offline shell.
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).catch(() => caches.match('/offline')))
        return
    }

    if (!sameOrigin) return

    // Content-hashed bundles: cache-first (immutable, safe forever).
    if (isImmutableStatic(url)) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async (cache) => {
                const hit = await cache.match(req)
                if (hit) return hit
                const res = await fetch(req)
                if (res && res.ok) cache.put(req, res.clone())
                return res
            }).catch(() => fetch(req)),
        )
        return
    }

    // Stable icons/manifest: stale-while-revalidate.
    if (isStableAsset(url)) {
        event.respondWith(
            caches.open(STATIC_CACHE).then(async (cache) => {
                const hit = await cache.match(req)
                const network = fetch(req)
                    .then((res) => {
                        if (res && res.ok) cache.put(req, res.clone())
                        return res
                    })
                    .catch(() => hit)
                return hit || network
            }),
        )
        return
    }

    // Everything else (API, auth, Supabase, HTML data) — straight to network.
})
