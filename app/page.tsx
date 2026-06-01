'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Loader2, Shield, Mail, Lock, User, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { validateGhanaianPhone } from '@/lib/phone-validation'
import { cn } from '@/lib/utils'

export default function AuthPage() {
    const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin')

    // Sign-in form state
    const [signInData, setSignInData] = useState({ email: '', password: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [signInLoading, setSignInLoading] = useState(false)
    const [signInError, setSignInError] = useState('')

    // Sign-up form state
    const [signUpData, setSignUpData] = useState({
        fullName: '',
        email: '',
        phoneNumber: '',
        password: ''
    })
    const [showSignUpPassword, setShowSignUpPassword] = useState(false)
    const [signUpLoading, setSignUpLoading] = useState(false)
    const [signUpError, setSignUpError] = useState('')
    const [signUpSuccess, setSignUpSuccess] = useState(false)

    const { signIn, signUp } = useAuth()
    const router = useRouter()

    const handleSignInChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setSignInData(prev => ({ ...prev, [name]: value }))
    }

    const handleSignUpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setSignUpData(prev => ({ ...prev, [name]: value }))
    }

    const handleSignInSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSignInError('')
        setSignInLoading(true)

        try {
            const { error } = await signIn(signInData.email, signInData.password)

            if (error) {
                setSignInError(error.message)
                return
            }

            toast.success('Welcome back!')
            window.location.href = '/dashboard'
        } catch (err) {
            setSignInError('An unexpected error occurred')
        } finally {
            setSignInLoading(false)
        }
    }

    const handleSignUpSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSignUpError('')

        // Validate phone
        const phoneValidation = validateGhanaianPhone(signUpData.phoneNumber)
        if (!phoneValidation.isValid) {
            setSignUpError(phoneValidation.error || 'Invalid phone number')
            return
        }

        // Validate password
        if (signUpData.password.length < 8) {
            setSignUpError('Password must be at least 8 characters')
            return
        }

        // Split full name
        const nameParts = signUpData.fullName.trim().split(' ')
        const firstName = nameParts[0]
        const lastName = nameParts.slice(1).join(' ') || ''

        setSignUpLoading(true)

        try {
            const { error, data } = await signUp({
                email: signUpData.email,
                password: signUpData.password,
                firstName,
                lastName,
                phoneNumber: phoneValidation.normalizedNumber
            })

            if (error) {
                setSignUpError(error.message)
                return
            }

            // Send welcome email
            fetch('/api/emails/welcome', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: signUpData.email,
                    firstName,
                    lastName,
                    phoneNumber: phoneValidation.normalizedNumber
                })
            }).catch(err => console.error('Welcome email error:', err))

            if (data?.session) {
                toast.success('Account created! Logging in...')
                router.push('/dashboard')
                return
            }

            setSignUpSuccess(true)
            toast.success('Account created successfully!')
        } catch (err) {
            setSignUpError('An unexpected error occurred')
        } finally {
            setSignUpLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-muted/40 flex flex-col items-center justify-center px-4 py-10">
            {/* Logo and Header */}
            <div className="mb-8 flex flex-col items-center gap-4 text-center">
                <div className="w-20 h-20 rounded-full border-2 border-primary bg-white shadow-sm p-1 flex items-center justify-center">
                    <Image
                        src="/logo.png"
                        alt="GAMER PLUG Logo"
                        width={64}
                        height={64}
                        className="object-contain"
                        priority
                    />
                </div>
                <div>
                    <h1 className="text-3xl font-black text-foreground mb-2 tracking-tight">
                        GAMER PLUG
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium">
                        Sign in or create an account to get started.
                    </p>
                </div>
            </div>

            {/* Auth Card */}
            <Card className="w-full max-w-md border border-border shadow-md rounded-2xl overflow-hidden">
                <CardContent className="p-6 space-y-6">
                    {/* Tab Toggle */}
                    <div className="flex gap-2 bg-muted/60 rounded-xl p-1 w-full">
                        <button
                            onClick={() => {
                                setActiveTab('signin')
                                setSignInError('')
                            }}
                            className={cn(
                                'flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200',
                                activeTab === 'signin'
                                    ? 'bg-white text-foreground shadow-sm'
                                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                            )}
                        >
                            Sign in
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('signup')
                                setSignUpError('')
                            }}
                            className={cn(
                                'flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all duration-200',
                                activeTab === 'signup'
                                    ? 'bg-white text-foreground shadow-sm'
                                    : 'bg-transparent text-muted-foreground hover:text-foreground'
                            )}
                        >
                            Create account
                        </button>
                    </div>

                    {/* Sign In Form */}
                    {activeTab === 'signin' && !signUpSuccess && (
                        <form onSubmit={handleSignInSubmit} className="space-y-4">
                            {signInError && (
                                <Alert variant="destructive" className="bg-destructive/10 border-destructive/50 py-2.5 rounded-lg">
                                    <AlertDescription className="text-sm text-destructive flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse flex-shrink-0" />
                                        {signInError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="signin-email" className="text-sm font-medium text-foreground">
                                    Email Address
                                </Label>
                                <div className="relative group">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="signin-email"
                                        name="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={signInData.email}
                                        onChange={handleSignInChange}
                                        required
                                        className="pl-11 h-11 text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="signin-password" className="text-sm font-medium text-foreground">
                                        Password
                                    </Label>
                                    <Link
                                        href="/auth/reset-password"
                                        className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative group">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="signin-password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter your password"
                                        value={signInData.password}
                                        onChange={handleSignInChange}
                                        required
                                        className="pl-11 pr-11 h-11 text-base"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={signInLoading}
                                className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg transition-all"
                            >
                                {signInLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Signing in...
                                    </>
                                ) : (
                                    'Sign in'
                                )}
                            </Button>
                        </form>
                    )}

                    {/* Create Account Form */}
                    {activeTab === 'signup' && !signUpSuccess && (
                        <form onSubmit={handleSignUpSubmit} className="space-y-4">
                            {signUpError && (
                                <Alert variant="destructive" className="bg-destructive/10 border-destructive/50 py-2.5 rounded-lg">
                                    <AlertDescription className="text-sm text-destructive flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse flex-shrink-0" />
                                        {signUpError}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="signup-fullname" className="text-sm font-medium text-foreground">
                                    Full name
                                </Label>
                                <div className="relative group">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="signup-fullname"
                                        name="fullName"
                                        type="text"
                                        placeholder="John Doe"
                                        value={signUpData.fullName}
                                        onChange={handleSignUpChange}
                                        required
                                        className="pl-11 h-11 text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="signup-email" className="text-sm font-medium text-foreground">
                                    Email Address
                                </Label>
                                <div className="relative group">
                                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="signup-email"
                                        name="email"
                                        type="email"
                                        placeholder="your@email.com"
                                        value={signUpData.email}
                                        onChange={handleSignUpChange}
                                        required
                                        className="pl-11 h-11 text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="signup-phone" className="text-sm font-medium text-foreground">
                                    Mobile Number
                                </Label>
                                <div className="relative group">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="signup-phone"
                                        name="phoneNumber"
                                        type="tel"
                                        placeholder="0541234567"
                                        value={signUpData.phoneNumber}
                                        onChange={handleSignUpChange}
                                        required
                                        className="pl-11 h-11 text-base"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="signup-password" className="text-sm font-medium text-foreground">
                                    Password
                                </Label>
                                <div className="relative group">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Input
                                        id="signup-password"
                                        name="password"
                                        type={showSignUpPassword ? 'text' : 'password'}
                                        placeholder="At least 8 characters"
                                        value={signUpData.password}
                                        onChange={handleSignUpChange}
                                        required
                                        className="pl-11 pr-11 h-11 text-base"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        {showSignUpPassword ? (
                                            <EyeOff className="w-5 h-5" />
                                        ) : (
                                            <Eye className="w-5 h-5" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={signUpLoading}
                                className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg transition-all"
                            >
                                {signUpLoading ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Creating...
                                    </>
                                ) : (
                                    'Send verification code'
                                )}
                            </Button>

                            <p className="text-xs text-center text-muted-foreground font-medium">
                                By creating an account you agree to our{' '}
                                <Link href="/terms" className="text-primary hover:text-primary/80 transition-colors">
                                    Terms
                                </Link>
                                {' '}&{' '}
                                <Link href="/privacy" className="text-primary hover:text-primary/80 transition-colors">
                                    Privacy Policy
                                </Link>
                                .
                            </p>
                        </form>
                    )}

                    {/* Success State */}
                    {signUpSuccess && (
                        <div className="text-center py-4 space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                                <Mail className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground mb-2">Check Your Email</h2>
                                <p className="text-sm text-muted-foreground">
                                    We've sent a verification link to <strong className="text-foreground">{signUpData.email}</strong>.
                                </p>
                            </div>
                            <Button
                                onClick={() => {
                                    setSignUpSuccess(false)
                                    setActiveTab('signin')
                                    setSignUpData({ fullName: '', email: '', phoneNumber: '', password: '' })
                                }}
                                className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90 text-white rounded-lg transition-all"
                            >
                                Back to Sign In
                            </Button>
                        </div>
                    )}

                    {/* Encryption Badge */}
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mt-6 pt-6 border-t border-border">
                        <Shield className="w-4 h-4" />
                        <span>Secured with bank-grade encryption</span>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <p className="text-xs text-muted-foreground mt-8 text-center font-medium">
                © 2025 Gamer Plug Solution · Built for data resellers
            </p>
        </div>
    )
}
