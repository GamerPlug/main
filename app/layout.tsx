import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#ffffff' },
        { media: '(prefers-color-scheme: dark)', color: '#0a0a10' },
    ],
    interactiveWidget: 'resizes-content',
}
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { Toaster } from '@/components/ui/sonner'
import { ThemeProvider } from '@/components/providers/theme-provider'
import { ServiceWorkerRegister } from '@/components/pwa/sw-register'
import { InstallPrompt } from '@/components/pwa/install-prompt'
import { GlobalLoader } from '@/components/ui/global-loader'

const inter = Inter({
    weight: ['300', '400', '500', '600', '700', '800', '900'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter'
})

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://gamerpluggh.com'),
    title: "Gamer Plug Solution - Ghana's #1 Data Reselling Platform",
    description: "Gamer Plug Solution powers your connection instantly. Buy fast, affordable data bundles for MTN, Telecel, and AirtelTigo in Ghana. Ghana's #1 trusted data reseller and supplier platform.",
    keywords: ['Ghana', 'mobile data', 'airtime', 'MTN', 'Telecel', 'AirtelTigo', 'data bundles', 'data reseller', 'data supplier', 'internet', 'Gamer Plug'],
    authors: [{ name: 'Gamer Plug Solution' }],
    applicationName: 'Gamer Plug Solution',
    manifest: '/manifest.webmanifest',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'Gamer Plug',
    },
    icons: {
        icon: '/logo.png',
        shortcut: '/logo.png',
        apple: '/icons/apple-touch-icon-180.png',
    },
    alternates: {
        canonical: '/',
    },
    openGraph: {
        title: "Gamer Plug Solution - Ghana's #1 Data Reselling Platform",
        description: "Power your connection instantly. Buy affordable data bundles for MTN, Telecel and AirtelTigo across Ghana.",
        type: 'website',
        url: '/',
        siteName: 'Gamer Plug Solution',
        locale: 'en_GH',
        images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Gamer Plug Solution' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: "Gamer Plug Solution - Ghana's #1 Data Reselling Platform",
        description: "Power your connection instantly. Buy affordable data bundles for MTN, Telecel and AirtelTigo across Ghana.",
        images: ['/logo.png'],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans`}>
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem
                    disableTransitionOnChange
                >
                    <AuthProvider>
                        {children}
                        <Toaster position="top-right" richColors />
                        <InstallPrompt />
                        <GlobalLoader />
                    </AuthProvider>
                    <ServiceWorkerRegister />
                </ThemeProvider>
            </body>
        </html>
    )
}
