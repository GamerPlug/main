'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Mail, ArrowLeft, Activity } from 'lucide-react'
import { BackgroundBubbles } from '@/components/background-bubbles'
import { FloatingWhatsApp } from '@/components/floating-whatsapp'

export default function ResetPasswordPage() {
    const [email, setEmail] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const supabase = createClientComponentClient()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/update-password`,
            })

            if (error) {
                setError(error.message)
                return
            }

            setSuccess(true)
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
                <div className="flex flex-col items-center mb-8 text-center px-4 group">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary via-accent to-secondary rounded-2xl flex items-center justify-center shadow-lg relative mb-5 transform transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6">
                        <div className="absolute inset-0 bg-primary/40 rounded-2xl blur-xl transition-colors"></div>
                        <Activity className="w-8 h-8 text-white relative z-10" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tight drop-shadow-sm mb-2 font-orbitron">
                        GAMER PLUG
                    </h1>
                    <p className="text-slate-400 font-medium text-sm sm:text-base">No worries! We'll help you get back in.</p>
                </div>

                <Card className="w-full border-0 glass-card rounded-3xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 gradient-primary"></div>
                    <CardContent className="p-6 sm:p-8">
                        {!success ? (
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
                                    <p className="text-xs text-slate-400 pt-2 px-1 font-medium">
                                        We'll send you a secure link to reset your password.
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-14 text-base font-bold gradient-primary hover:glow-primary text-white shadow-xl rounded-xl transition-all duration-300 mt-2"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Sending secure link...
                                        </>
                                    ) : (
                                        'Send Reset Link'
                                    )}
                                </Button>
                            </form>
                        ) : (
                            <div className="text-center py-6 animate-fadeIn">
                                <div className="relative w-20 h-20 mx-auto mb-6">
                                    <div className="absolute inset-0 bg-emerald-500/30 rounded-full blur-xl animate-pulseGlow"></div>
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center relative z-10 shadow-lg border border-white/20">
                                        <Mail className="w-10 h-10 text-white" />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Check Your Email</h2>
                                <p className="text-slate-300 text-sm font-medium">
                                    Secure reset link sent to<br />
                                    <strong className="text-white mt-1 block">{email}</strong>
                                </p>
                            </div>
                        )}

                        <div className="mt-8 border-t border-white/10 pt-6 text-center">
                            <Link
                                href="/auth/login"
                                className="inline-flex items-center justify-center w-full h-12 text-sm font-semibold bg-white/5 hover:bg-white/10 border-white/10 text-white rounded-xl transition-all hover:border-white/20"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Sign In
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
