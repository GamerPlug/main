'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, LogIn, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { BackgroundBubbles } from '@/components/background-bubbles'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'
import { WhatsAppCommunityButtons } from '@/components/whatsapp-community-buttons'
import { useSettings } from '@/hooks/use-settings'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const { signIn } = useAuth()
    const { settings } = useSettings()
    const router = useRouter()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const { error } = await signIn(email, password)

            if (error) {
                setError(error.message)
                return
            }

            toast.success('Welcome back!')
            window.location.href = '/dashboard'
        } catch (err) {
            setError('An unexpected error occurred')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 sm:py-10 overflow-y-auto">
            <BackgroundBubbles scrollable />
            <FloatingWhatsApp variant="auth" />

            <div className="w-full max-w-[380px] sm:max-w-md relative z-10 flex flex-col items-center animate-slideInUp">
                {/* Logo - professional and visible */}
                <div className="text-center mb-8">
                    <Link href="/" className="inline-flex flex-col items-center group">
                        <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-4 transition-transform duration-500 group-hover:scale-105">
                            <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl group-hover:bg-primary/40 transition-colors"></div>
                            <div className="w-full h-full rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
                                <Image
                                    src="/logo.png"
                                    alt="GAMER PLUG"
                                    fill
                                    className="object-contain p-2 drop-shadow-lg"
                                    priority
                                />
                            </div>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tight drop-shadow-sm font-orbitron">
                            GAMER PLUG
                        </h1>
                        <p className="text-base text-slate-400 mt-2 font-medium">
                            Sign in to continue
                        </p>
                    </Link>
                </div>

                <Card className="w-full border-0 glass-card rounded-3xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 gradient-primary"></div>
                    <CardContent className="p-5 sm:p-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {error && (
                                <Alert variant="destructive" className="bg-destructive/10 border-destructive/50 py-3 rounded-xl backdrop-blur-sm">
                                    <AlertDescription className="text-red-400 font-medium text-sm flex items-center">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 mr-2 animate-pulse"></div>
                                        {error}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-300 font-medium text-sm ml-1">Email Address</Label>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
                                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors z-10" />
                                    <Input
                                        id="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="relative z-10 h-14 pl-12 bg-black/40 border-white/10 text-white placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary/50 hover:bg-black/60 transition-all rounded-xl text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-300 font-medium text-sm ml-1">Password</Label>
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-primary/20 rounded-xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-300"></div>
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary transition-colors z-10" />
                                    <Input
                                        id="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="relative z-10 h-14 pl-12 pr-12 bg-black/40 border-white/10 text-white placeholder:text-slate-500 focus:border-primary focus:ring-1 focus:ring-primary/50 hover:bg-black/60 transition-all rounded-xl text-base"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors z-10"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="w-full h-14 text-base font-bold gradient-primary hover:glow-primary text-white shadow-xl rounded-xl transition-all duration-300 mt-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Authenticating...
                                    </>
                                ) : (
                                    <>
                                        <LogIn className="w-5 h-5 mr-2 group-hover:translate-x-1 transition-transform" />
                                        Sign In Securely
                                    </>
                                )}
                            </Button>
                        </form>

                        <div className="flex items-center my-6 relative">
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                            <span className="px-4 text-xs font-semibold text-slate-400 uppercase tracking-widest bg-transparent">OR</span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mt-2">
                            <Button
                                asChild
                                variant="outline"
                                className="flex-1 h-12 text-sm font-semibold bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-xl transition-all hover:border-white/20"
                            >
                                <Link href="/auth/signup">
                                    Create Account
                                </Link>
                            </Button>
                            <Button
                                asChild
                                variant="ghost"
                                className="flex-1 h-12 text-sm font-semibold bg-transparent hover:bg-white/5 text-slate-300 hover:text-white rounded-xl transition-all"
                            >
                                <Link href="/auth/reset-password">
                                    Forgot Password?
                                </Link>
                            </Button>
                        </div>

                        <div className="mt-8 border-t border-white/10 pt-6">
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-slate-400 text-center uppercase tracking-wider">Join Our Community</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <a
                                        href={settings.whatsappGroupLink || "https://chat.whatsapp.com/FC6jYV3VDEQ4MmdTXiFqDV?mode=gi_t"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/30 text-[#25D366] hover:text-white hover:border-[#25D366]/50 font-semibold text-sm transition-all duration-300"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        Group
                                    </a>
                                    <a
                                        href={settings.whatsappChannelLink || "https://whatsapp.com/channel/0029Vb7HTfx47XeIZz7ht232"}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/30 text-[#25D366] hover:text-white hover:border-[#25D366]/50 font-semibold text-sm transition-all duration-300"
                                    >
                                        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.88 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                        </svg>
                                        Channel
                                    </a>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-center text-slate-500 mt-6 font-medium">
                            By signing in, you agree to our <Link href="/terms" className="text-slate-300 hover:text-white transition-colors">Terms</Link> and <Link href="/privacy" className="text-slate-300 hover:text-white transition-colors">Privacy Policy</Link>
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
