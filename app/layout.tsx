import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: '#0a1628',
    interactiveWidget: 'resizes-content',
}
import { Orbitron, Rajdhani } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/providers/theme-provider'

const orbitron = Orbitron({
    weight: ['400', '500', '600', '700', '800', '900'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-orbitron'
})

const rajdhani = Rajdhani({
    weight: ['300', '400', '500', '600', '700'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-rajdhani'
})

export const metadata: Metadata = {
    title: "Gamer Plug Solution - Ghana's #1 High-Speed Data & Gaming Hub",
    description: "Gamer Plug Solution powers your connection instantly. Buy fast, affordable data bundles for MTN, Telecel, and AirtelTigo in Ghana. Ghana's #1 trusted data reseller platform.",
    keywords: ['Ghana', 'mobile data', 'airtime', 'MTN', 'Telecel', 'AirtelTigo', 'data bundles', 'gaming', 'internet', 'Gamer Plug'],
    authors: [{ name: 'Gamer Plug Solution' }],
    icons: {
        icon: '/logo.png',
        shortcut: '/logo.png',
        apple: '/logo.png',
    },
    openGraph: {
        title: "Gamer Plug Solution - Ghana's #1 Data Hub",
        description: "Power your connection instantly. Buy data packages for all Ghanaian networks.",
        type: 'website',
        images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Gamer Plug Solution' }],
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${orbitron.variable} ${rajdhani.variable} font-rajdhani`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AuthProvider>
                        {children}
                        <Toaster position="top-right" richColors />
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    )
}
