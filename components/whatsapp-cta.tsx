'use client'

import React from 'react'
import { Smartphone } from 'lucide-react'
import { useSettings } from '@/hooks/use-settings'

export function WhatsAppCTA() {
    const { settings } = useSettings()
    
    const cleanNumber = (num: string) => num.replace(/\+/g, '').replace(/\s/g, '')
    const rawNumber = settings.contactWhatsApp || settings.contactPhone || '233578065809'
    const PHONE_NUMBER = cleanNumber(rawNumber)
    const WHATSAPP_URL = `https://wa.me/${PHONE_NUMBER}`

    return (
        <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-[#25D366]/20 border border-[#25D366]/30 hover:bg-[#25D366]/30 text-[#25D366] transition-all hover:scale-105 shadow-[0_0_20px_rgba(37,211,102,0.15)] group"
        >
            <Smartphone className="w-5 h-5 group-hover:rotate-12 transition-transform" />
            <span className="font-bold text-sm tracking-wide">Contact Us on WhatsApp</span>
        </a>
    )
}
