'use client'

import { useCallback, useEffect, useState } from 'react'

function urlBase64ToUint8Array(base64String: string): BufferSource {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const rawData = atob(base64)
    const buffer = new ArrayBuffer(rawData.length)
    const outputArray = new Uint8Array(buffer)
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i)
    return outputArray
}

export interface UsePushNotifications {
    isSupported: boolean
    permission: NotificationPermission
    isSubscribed: boolean
    isBusy: boolean
    subscribe: () => Promise<boolean>
    unsubscribe: () => Promise<boolean>
}

export function usePushNotifications(): UsePushNotifications {
    const [isSupported, setIsSupported] = useState(false)
    const [permission, setPermission] = useState<NotificationPermission>('default')
    const [isSubscribed, setIsSubscribed] = useState(false)
    const [isBusy, setIsBusy] = useState(false)

    useEffect(() => {
        const supported =
            typeof window !== 'undefined' &&
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        setIsSupported(supported)
        if (!supported) return

        setPermission(Notification.permission)
        navigator.serviceWorker.ready
            .then(async (reg) => {
                const sub = await reg.pushManager.getSubscription()
                setIsSubscribed(!!sub)
            })
            .catch(() => {})
    }, [])

    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false
        const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapid) {
            console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set')
            return false
        }
        setIsBusy(true)
        try {
            const perm = await Notification.requestPermission()
            setPermission(perm)
            if (perm !== 'granted') return false

            const reg = await navigator.serviceWorker.ready
            let sub = await reg.pushManager.getSubscription()
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapid),
                })
            }

            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription: sub.toJSON() }),
            })
            if (!res.ok) return false

            setIsSubscribed(true)
            return true
        } catch (err) {
            console.error('Push subscribe error:', err)
            return false
        } finally {
            setIsBusy(false)
        }
    }, [isSupported])

    const unsubscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported) return false
        setIsBusy(true)
        try {
            const reg = await navigator.serviceWorker.ready
            const sub = await reg.pushManager.getSubscription()
            if (sub) {
                const endpoint = sub.endpoint
                await sub.unsubscribe()
                await fetch('/api/push/unsubscribe', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ endpoint }),
                })
            }
            setIsSubscribed(false)
            return true
        } catch (err) {
            console.error('Push unsubscribe error:', err)
            return false
        } finally {
            setIsBusy(false)
        }
    }, [isSupported])

    return { isSupported, permission, isSubscribed, isBusy, subscribe, unsubscribe }
}
