'use client'

import { cn } from '@/lib/utils'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
    User,
    Mail,
    Phone,
    Calendar,
    Shield,
    LogOut,
    Loader2,
    AlertCircle,
    CheckCircle2,
    Crown
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { roleConfig, UserRole } from '@/lib/roles'
import { useTutorial } from '@/hooks/useTutorial'
import { HelpButton } from '@/components/tutorial/HelpButton'

export default function ProfilePage() {
    const { dbUser, signOut, refreshUser } = useAuth()

    // Tutorial hook
    const userRole = dbUser?.role === 'agent' ? 'agent' : 'user'
    const { startTutorial } = useTutorial(userRole as 'user' | 'agent', '/profile')

    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone_number: '',
    })

    // Password change
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })
    const [passwordSaving, setPasswordSaving] = useState(false)


    useEffect(() => {
        if (dbUser) {
            setFormData({
                first_name: dbUser.first_name || '',
                last_name: dbUser.last_name || '',
                phone_number: dbUser.phone_number || '',
            })
        }
    }, [dbUser])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({
            ...prev,
            [e.target.name]: e.target.value
        }))
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            const { error } = await (supabase
                .from('users') as any)
                .update({
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    phone_number: formData.phone_number,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', dbUser?.id as any)

            if (error) throw error

            await refreshUser()
            setIsEditing(false)
            toast.success('Profile updated successfully')
        } catch (error) {
            toast.error('Failed to update profile')
        } finally {
            setIsSaving(false)
        }
    }

    const handlePasswordChange = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            toast.error('Passwords do not match')
            return
        }

        if (passwordData.newPassword.length < 8) {
            toast.error('Password must be at least 8 characters')
            return
        }

        setPasswordSaving(true)
        try {
            // Verify current password by re-signing in
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: dbUser?.email || '',
                password: passwordData.currentPassword,
            })

            if (signInError) {
                toast.error('Current password is incorrect')
                return
            }

            // Update password
            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword,
            })

            if (error) throw error

            setIsChangingPassword(false)
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
            toast.success('Password changed successfully')
        } catch (error) {
            toast.error('Failed to change password')
        } finally {
            setPasswordSaving(false)
        }
    }


    const getInitials = () => {
        return `${dbUser?.first_name?.[0] || ''}${dbUser?.last_name?.[0] || ''}`.toUpperCase()
    }

    return (
        <div className="space-y-8 max-w-3xl scroll-smooth relative z-10 pb-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">My Profile</h1>
                    <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-1">Manage your account settings and preferences</p>
                </div>
                <HelpButton onClick={startTutorial} />
            </div>

            {/* Profile Card */}
            <div id="personal-info" className={cn(
                "glass-card rounded-[2rem] p-6 relative overflow-hidden group transition-all bg-white dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl",
                dbUser?.role === 'agent' ? "border-yellow-500/20 shadow-sm dark:shadow-[0_0_30px_rgba(234,179,8,0.1)]" : "border-slate-200 dark:border-white/5"
            )}>
                {/* Background Glows */}
                {dbUser?.role === 'agent' ? (
                    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl group-hover:bg-yellow-500/20 transition-colors pointer-events-none"></div>
                ) : (
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors pointer-events-none"></div>
                )}

                <div className="relative z-10">
                    <div className="flex flex-col sm:flex-row items-center gap-6 border-b border-slate-100 dark:border-white/5 pb-6 mb-6">
                        {(() => {
                            const userRole = (dbUser?.role || 'user') as UserRole
                            const config = roleConfig[userRole] || roleConfig['user']
                            const RoleIcon = config.icon
                            return (
                                <div
                                    className="w-24 h-24 rounded-2xl flex items-center justify-center text-white shadow-xl backdrop-blur-md relative overflow-hidden group-hover:scale-105 transition-transform"
                                    style={{ backgroundColor: `${config.color}20`, border: `1px solid ${config.color}40` }}
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                                    <RoleIcon className="w-12 h-12 relative z-10 drop-shadow-lg" style={{ color: config.color }} />
                                </div>
                            )
                        })()}
                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center justify-center sm:justify-start gap-2 flex-wrap mb-1">
                                <span className={cn(
                                    "flex items-center gap-2",
                                    dbUser?.role === 'agent' && "text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]"
                                )}>
                                    {dbUser?.first_name} {dbUser?.last_name}
                                    {dbUser?.role === 'agent' && (
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-yellow-500/10 dark:bg-yellow-500/20 border border-yellow-500/20 dark:border-yellow-500/30 shadow-inner align-middle ml-2">
                                            <Crown className="w-3.5 h-3.5 text-yellow-600 dark:text-yellow-400" />
                                            <span className="text-[10px] font-black text-yellow-600 dark:text-yellow-500 uppercase tracking-widest">PREMIUM</span>
                                        </div>
                                    )}
                                </span>
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 font-bold mb-4">{dbUser?.email}</p>

                            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                <Badge className="bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/20 border-slate-200 dark:border-white/10 text-[10px] uppercase font-bold tracking-widest px-3">
                                    {dbUser?.role || 'User'}
                                </Badge>
                                <Badge className="bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30 text-[10px] uppercase font-bold tracking-widest px-3">
                                    {dbUser?.status || 'Active'}
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        {isEditing ? (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="first_name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">First Name</Label>
                                        <Input
                                            id="first_name"
                                            name="first_name"
                                            value={formData.first_name}
                                            onChange={handleChange}
                                            className="h-12 bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-base shadow-inner"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="last_name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Last Name</Label>
                                        <Input
                                            id="last_name"
                                            name="last_name"
                                            value={formData.last_name}
                                            onChange={handleChange}
                                            className="h-12 bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-base shadow-inner"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone_number" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Phone Number</Label>
                                    <Input
                                        id="phone_number"
                                        name="phone_number"
                                        value={formData.phone_number}
                                        onChange={handleChange}
                                        className="h-12 bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-base shadow-inner"
                                    />
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                    <Button onClick={handleSave} disabled={isSaving} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs gradient-primary hover:glow-primary shadow-xl">
                                        {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                        Save Changes
                                    </Button>
                                    <Button variant="outline" onClick={() => setIsEditing(false)} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10">
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-black/40 border border-slate-100 dark:border-white/5 p-4 rounded-2xl group-hover:bg-slate-100/50 dark:group-hover:bg-white/5 transition-colors shadow-inner">
                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm dark:shadow-inner border border-slate-200 dark:border-transparent">
                                            <User className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-0.5">Full Name</p>
                                            <p className="font-black text-slate-900 dark:text-white text-lg leading-tight truncate">
                                                {dbUser?.first_name} {dbUser?.last_name}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-black/40 border border-slate-100 dark:border-white/5 p-4 rounded-2xl group-hover:bg-slate-100/50 dark:group-hover:bg-white/5 transition-colors shadow-inner">
                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm dark:shadow-inner border border-slate-200 dark:border-transparent">
                                            <Mail className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-0.5">Email</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-300 truncate">{dbUser?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-black/40 border border-slate-100 dark:border-white/5 p-4 rounded-2xl group-hover:bg-slate-100/50 dark:group-hover:bg-white/5 transition-colors shadow-inner">
                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm dark:shadow-inner border border-slate-200 dark:border-transparent">
                                            <Phone className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-0.5">Phone Number</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{dbUser?.phone_number || 'N/A'}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 bg-slate-50/50 dark:bg-black/40 border border-slate-100 dark:border-white/5 p-4 rounded-2xl group-hover:bg-slate-100/50 dark:group-hover:bg-white/5 transition-colors shadow-inner">
                                        <div className="w-12 h-12 rounded-xl bg-white dark:bg-white/5 flex items-center justify-center shadow-sm dark:shadow-inner border border-slate-200 dark:border-transparent">
                                            <Calendar className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-widest mb-0.5">Member Since</p>
                                            <p className="font-bold text-slate-700 dark:text-slate-300">{dbUser?.created_at ? formatDate(dbUser.created_at) : 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 mt-2 border-t border-slate-100 dark:border-white/5">
                                    <Button onClick={() => setIsEditing(true)} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 transition-all shadow-sm dark:shadow-md">
                                        Edit Profile
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Security Card */}
            <div id="security-section" className="glass-card rounded-[2rem] p-6 relative overflow-hidden group border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 dark:bg-cyan-500/10 rounded-full blur-3xl group-hover:bg-cyan-500/10 dark:group-hover:bg-cyan-500/20 transition-colors pointer-events-none"></div>

                <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 shadow-inner border border-cyan-500/20 dark:border-transparent">
                            <Shield className="w-6 h-6 text-cyan-600 dark:text-cyan-400 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight drop-shadow-sm dark:drop-shadow-md">Security</h2>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Manage your password</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    {isChangingPassword ? (
                        <div className="space-y-4 max-w-md">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-base shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-base shadow-inner"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                    className="h-12 bg-slate-50 dark:bg-black/40 backdrop-blur-xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl focus-visible:ring-primary/50 text-base shadow-inner"
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                <Button onClick={handlePasswordChange} disabled={passwordSaving} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-500 dark:to-blue-500 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg dark:shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-xl dark:hover:shadow-[0_0_20px_rgba(6,182,212,0.5)] border-0">
                                    {passwordSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Change Password
                                </Button>
                                <Button variant="outline" onClick={() => setIsChangingPassword(false)} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10">
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button onClick={() => setIsChangingPassword(true)} className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-md transition-all">
                            Change Password
                        </Button>
                    )}
                </div>
            </div>

            {/* Log Out Section */}
            <div className="glass-card rounded-[2rem] p-6 relative overflow-hidden group border-slate-200 dark:border-white/5 bg-white/50 dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl">
                <div className="absolute top-0 left-0 w-64 h-64 bg-slate-500/5 dark:bg-slate-500/10 rounded-full blur-3xl group-hover:bg-slate-500/10 dark:group-hover:bg-slate-500/20 transition-colors pointer-events-none"></div>

                <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-slate-500/10 dark:bg-slate-500/20 shadow-inner border border-slate-200 dark:border-white/10">
                            <LogOut className="w-6 h-6 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">Account Session</h2>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">Securely end your current session</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10">
                    <Button
                        variant="ghost"
                        onClick={signOut}
                        className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-xs bg-slate-100 dark:bg-black/40 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/20 transition-all shadow-sm"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Log Out Securely
                    </Button>
                </div>
            </div>

        </div>
    )
}
