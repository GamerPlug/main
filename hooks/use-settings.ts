import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface GeneralSettings {
    supportEmail: string
    contactPhone: string
    contactWhatsApp: string
    contactAddress: string
    whatsappGroupLink: string
    whatsappChannelLink: string
    guestPurchaseEnabled: boolean
    walletTopupEnabled: boolean
}

export function useSettings() {
    const [settings, setSettings] = useState<GeneralSettings>({
        supportEmail: '',
        contactPhone: '',
        contactWhatsApp: '233578065809', // Default fallback
        contactAddress: '',
        whatsappGroupLink: 'https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV?mode=gi_t', // Default fallback
        whatsappChannelLink: 'https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232', // Default fallback
        guestPurchaseEnabled: true,
        walletTopupEnabled: true,
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const { data, error } = await (supabase
                .from('admin_settings') as any)
                .select('*')
                .in('key', [
                    'support_email',
                    'contact_phone',
                    'contact_whatsapp',
                    'contact_address',
                    'whatsapp_group_link',
                    'whatsapp_channel_link',
                    'guest_purchase_enabled',
                    'wallet_topup_enabled'
                ])

            if (error) throw error

            const settingsMap = data.reduce((acc: any, curr: any) => {
                acc[curr.key] = curr.value
                return acc
            }, {})

            setSettings({
                supportEmail: settingsMap.support_email || '',
                contactPhone: settingsMap.contact_phone || '',
                contactWhatsApp: settingsMap.contact_whatsapp || '',
                contactAddress: settingsMap.contact_address || '',
                whatsappGroupLink: settingsMap.whatsapp_group_link || '',
                whatsappChannelLink: settingsMap.whatsapp_channel_link || '',
                guestPurchaseEnabled: settingsMap.guest_purchase_enabled !== 'false',
                walletTopupEnabled: settingsMap.wallet_topup_enabled !== 'false',
            })
        } catch (error) {
            console.error('Error fetching general settings:', error)
        } finally {
            setLoading(false)
        }
    }

    return { settings, loading, refreshSettings: fetchSettings }
}
