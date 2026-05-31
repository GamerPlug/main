'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { User as DBUser } from '@/types/supabase'
import { useRouter } from 'next/navigation'

interface AuthContextType {
    user: User | null
    dbUser: DBUser | null
    session: Session | null
    isLoading: boolean
    isAdmin: boolean
    isSubAdmin: boolean
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>
    signUp: (data: SignUpData) => Promise<{ error: Error | null, data: { user: User | null, session: Session | null } | null }>
    signOut: () => Promise<void>
    refreshUser: () => Promise<void>
}

interface SignUpData {
    email: string
    password: string
    firstName: string
    lastName: string
    phoneNumber: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const INACTIVITY_TIMEOUT = 60 * 60 * 1000 // 1 hour (60 minutes)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [dbUser, setDbUser] = useState<DBUser | null>(null)
    const [session, setSession] = useState<Session | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [lastActivity, setLastActivity] = useState(Date.now())
    const router = useRouter()

    const isAdmin = dbUser?.role === 'admin'
    const isSubAdmin = dbUser?.role === 'sub-admin'

    const fetchDbUser = useCallback(async (userId: string, retries = 3) => {
        let attempt = 0
        while (attempt < retries) {
            try {
                // Add 15 second timeout to prevent hanging
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Database timeout')), 15000)
                )

                console.log(`[AuthContext] Fetching DB user for ID: ${userId} (Attempt ${attempt + 1})`)

                // Use explicit columns instead of SELECT * for better performance
                const query = supabase
                    .from('users')
                    .select('id, email, first_name, last_name, phone_number, role, status, requires_settlement, agent_expires_at, created_at, updated_at, wallets(balance, credit_limit, unlimited_credit)')
                    .eq('id', userId)
                    .single()

                const { data, error } = await Promise.race([
                    query,
                    timeout
                ]) as any

                if (error) {
                    // If no rows found, the user record hasn't been created yet by the trigger
                    if (error.code === 'PGRST116') {
                        console.warn(`[AuthContext] User record not found for ${userId}. Attempt ${attempt + 1}/${retries}`)
                        attempt++
                        if (attempt < retries) {
                            await new Promise(r => setTimeout(r, 2000 * attempt)) // Exponential backoff
                            continue
                        }
                        return
                    }
                    throw error
                }

                if (data) {
                    // Flatten wallets array to single object if present
                    const userData = {
                        ...data,
                        wallets: Array.isArray(data.wallets) ? (data.wallets[0] || null) : (data.wallets || null)
                    }
                    setDbUser(userData)
                    return // Success
                }
            } catch (error: any) {
                console.error(`[AuthContext] Error fetching user data (Attempt ${attempt + 1}/${retries}):`, error.message)
                attempt++
                if (attempt < retries) {
                    await new Promise(r => setTimeout(r, 2000 * attempt))
                }
            }
        }
    }, [])

    const refreshUser = useCallback(async () => {
        if (user) {
            await fetchDbUser(user.id)
        }
    }, [user, fetchDbUser])

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        return { error }
    }

    const signUp = async (data: SignUpData) => {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password,
            options: {
                data: {
                    first_name: data.firstName,
                    last_name: data.lastName,
                    phone_number: data.phoneNumber,
                },
            },
        })

        if (authError) return { error: authError, data: null }

        return { error: null, data: authData }
    }

    const signOut = async () => {
        await supabase.auth.signOut()
        setUser(null)
        setDbUser(null)
        setSession(null)
        router.push('/auth/login')
    }

    // Track user activity
    useEffect(() => {
        // Only track if user is logged in
        if (!user) return

        const updateActivity = () => {
            setLastActivity(Date.now())
        }

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
        events.forEach(event => {
            window.addEventListener(event, updateActivity)
        })

        return () => {
            events.forEach(event => {
                window.removeEventListener(event, updateActivity)
            })
        }
    }, [user])

    // Auto logout on inactivity
    useEffect(() => {
        if (!user) return

        const checkInactivity = setInterval(() => {
            if (Date.now() - lastActivity > INACTIVITY_TIMEOUT) {
                console.log('User inactive for 1 hour, redirecting to home...')
                // Sign out and redirect to home page
                supabase.auth.signOut()
                setUser(null)
                setDbUser(null)
                setSession(null)
                router.push('/')
            }
        }, 60000) // Check every minute

        return () => clearInterval(checkInactivity)
    }, [user, lastActivity])

    // 1. Initialize auth state (Run once on mount)
    useEffect(() => {
        const initAuth = async () => {
            try {
                // Total timeout for initialization
                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
                )

                const init = async () => {
                    const { data: { session: currentSession } } = await supabase.auth.getSession()
                    if (currentSession) {
                        setSession(currentSession)
                        setUser(currentSession.user)
                        // No need to fetch here, onAuthStateChange will handle it with INITIAL_SESSION
                    }
                }

                await Promise.race([init(), timeout])
            } catch (error) {
                console.error('Auth initialization error:', error)
            } finally {
                setIsLoading(false)
            }
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
                console.log(`[AuthContext] Auth event: ${event}`)
                
                // Only update state if session changed
                setSession(currentSession)
                setUser(currentSession?.user ?? null)

                if (currentSession?.user) {
                    // Only fetch if identity changed or specific events occurred
                    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') {
                        await fetchDbUser(currentSession.user.id)
                    }
                } else {
                    setDbUser(null)
                }
            }
        )

        return () => {
            subscription.unsubscribe()
        }
    }, [fetchDbUser]) // Only depend on fetchDbUser which is memoized

    // 2. Realtime subscription for user status/wallet updates (Depends on user identity)
    useEffect(() => {
        let userChannel: any;
        const userId = user?.id;

        if (userId) {
            console.log(`[AuthContext] Setting up Realtime sync for user: ${userId}`)
            userChannel = supabase
                .channel(`user-sync-${userId}`)
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
                    (payload) => {
                        console.log('[AuthContext] Realtime User update:', payload.new)
                        setDbUser(prev => prev ? { ...prev, ...payload.new } : null)
                    }
                )
                .on(
                    'postgres_changes',
                    { event: 'UPDATE', schema: 'public', table: 'wallets', filter: `user_id=eq.${userId}` },
                    (payload) => {
                        console.log('[AuthContext] Realtime Wallet update:', payload.new)
                        setDbUser(prev => prev ? { ...prev, wallets: { ...prev.wallets, ...(payload.new as any) } as any } : null)
                    }
                )
                .subscribe((status) => {
                    console.log(`[AuthContext] Realtime status for ${userId}:`, status)
                })
        }

        return () => {
            if (userChannel) {
                console.log(`[AuthContext] Cleaning up Realtime sync for user: ${userId}`)
                supabase.removeChannel(userChannel)
            }
        }
    }, [user?.id]) // Only re-run if the user identity changes

    return (
        <AuthContext.Provider
            value={{
                user,
                dbUser,
                session,
                isLoading,
                isAdmin,
                isSubAdmin,
                signIn,
                signUp,
                signOut,
                refreshUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
