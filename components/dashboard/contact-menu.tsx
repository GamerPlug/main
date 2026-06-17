'use client'

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/hooks/use-settings'
import { Headset, MessageCircle, Phone, Mail, Users, Radio, MapPin } from 'lucide-react'

function normalizeWa(num: string) {
    const digits = (num || '').replace(/[^\d]/g, '')
    return digits.startsWith('0') ? `233${digits.slice(1)}` : digits
}

export function ContactMenu() {
    const { settings } = useSettings()

    const wa = normalizeWa(settings.contactWhatsApp)
    const items: {
        key: string
        href: string
        external?: boolean
        icon: React.ElementType
        label: string
        sub: string
        tone: string
    }[] = []

    if (wa) items.push({ key: 'wa', href: `https://wa.me/${wa}`, external: true, icon: MessageCircle, label: 'Chat on WhatsApp', sub: 'Fastest response', tone: 'text-green-500' })
    if (settings.contactPhone) items.push({ key: 'call', href: `tel:${settings.contactPhone}`, icon: Phone, label: 'Call us', sub: settings.contactPhone, tone: 'text-blue-500' })
    if (settings.supportEmail) items.push({ key: 'mail', href: `mailto:${settings.supportEmail}`, icon: Mail, label: 'Email support', sub: settings.supportEmail, tone: 'text-amber-500' })
    if (settings.whatsappGroupLink) items.push({ key: 'group', href: settings.whatsappGroupLink, external: true, icon: Users, label: 'WhatsApp Group', sub: 'Join the community', tone: 'text-emerald-500' })
    if (settings.whatsappChannelLink) items.push({ key: 'channel', href: settings.whatsappChannelLink, external: true, icon: Radio, label: 'WhatsApp Channel', sub: 'Updates & offers', tone: 'text-indigo-500' })

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="relative text-foreground/60 hover:text-foreground hover:bg-muted transition-colors h-10 w-10 rounded-full"
                >
                    <Headset className="w-5 h-5" />
                    <span className="sr-only">Contact support</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[20rem] glass-card border-white/10 mt-2 p-0 overflow-hidden" align="end" forceMount>
                <div className="px-4 py-3 border-b border-border/60">
                    <p className="text-sm font-black text-foreground">Need help?</p>
                    <p className="text-xs font-medium text-foreground/55 mt-0.5">Reach the Gamer Plug team directly.</p>
                </div>

                <div className="p-1.5">
                    {items.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm font-medium text-foreground/50">
                            Contact details coming soon.
                        </p>
                    ) : (
                        items.map(({ key, href, external, icon: Icon, label, sub, tone }) => (
                            <a
                                key={key}
                                href={href}
                                target={external ? '_blank' : undefined}
                                rel={external ? 'noopener noreferrer' : undefined}
                                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/70 transition-colors"
                            >
                                <span className="w-9 h-9 rounded-lg bg-muted border border-border/50 flex items-center justify-center flex-shrink-0">
                                    <Icon className={`w-4 h-4 ${tone}`} />
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-[13px] font-bold text-foreground leading-tight">{label}</span>
                                    <span className="block text-xs text-foreground/55 truncate">{sub}</span>
                                </span>
                            </a>
                        ))
                    )}
                </div>

                {settings.contactAddress && (
                    <div className="px-4 py-3 border-t border-border/60 flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-foreground/40 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-foreground/55 leading-snug">{settings.contactAddress}</p>
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
