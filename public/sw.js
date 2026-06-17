/* Gamer Plug Solution — Service Worker
 * Hand-rolled: web push + notification click routing + minimal offline shell.
 * Intentionally does NOT cache authenticated/API/HTML data responses to avoid
 * serving stale wallet/order information.
 */
const CACHE = 'gp-shell-v2'
const APP_SHELL = ['/offline']

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}),
    )
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
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

// --- Minimal offline fallback for page navigations only ---
self.addEventListener('fetch', (event) => {
    const req = event.request
    if (req.method !== 'GET') return
    if (req.mode === 'navigate') {
        event.respondWith(fetch(req).catch(() => caches.match('/offline')))
    }
})
