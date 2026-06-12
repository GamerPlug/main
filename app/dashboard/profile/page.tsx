'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    User,
    Mail,
    Phone,
    Calendar,
    Shield,
    LogOut,
    Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDate } from '@/lib/utils'
import { roleConfig, UserRole } from '@/lib/roles'

export default function ProfilePage() {
    const { dbUser, signOut, refreshUser } = useAuth()

    const [isEditing, setIsEditing] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        phone_number: '',
    })

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
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
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
        } catch {
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
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: dbUser?.email || '',
                password: passwordData.currentPassword,
            })

            if (signInError) {
                toast.error('Current password is incorrect')
                return
            }

            const { error } = await supabase.auth.updateUser({
                password: passwordData.newPassword,
            })

            if (error) throw error

            setIsChangingPassword(false)
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
            toast.success('Password changed successfully')
        } catch {
            toast.error('Failed to change password')
        } finally {
            setPasswordSaving(false)
        }
    }

    const role = (dbUser?.role || 'agent') as UserRole
    const config = roleConfig[role] || roleConfig['agent']
    const RoleIcon = config.icon

    return (
        <div className="space-y-6 max-w-3xl pb-8">
            <div>
                <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">My Profile</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage your account settings</p>
            </div>

            {/* Profile Card */}
            <div
                id="personal-info"
                className="rounded-2xl p-6 border bg-white dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl relative overflow-hidden"
                style={{ borderColor: `${config.color}30` }}
            >
                <div
                    className="absolute top-0 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-60"
                    style={{ backgroundColor: `${config.color}12` }}
                />

                <div className="relative z-10">
                    {/* Avatar + Identity */}
                    <div className="flex flex-col sm:flex-row items-center gap-5 border-b border-slate-100 dark:border-white/5 pb-6 mb-6">
                        <div
                            className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg relative overflow-hidden shrink-0"
                            style={{ backgroundColor: `${config.color}18`, border: `1px solid ${config.color}35` }}
                        >
                            <RoleIcon className="w-10 h-10 drop-shadow" style={{ color: config.color }} />
                        </div>

                        <div className="flex-1 text-center sm:text-left">
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight mb-1">
                                {dbUser?.first_name} {dbUser?.last_name}
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{dbUser?.email}</p>
                            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                                <Badge
                                    className="text-[10px] uppercase font-bold tracking-widest px-3 border"
                                    style={{
                                        backgroundColor: `${config.color}15`,
                                        color: config.color,
                                        borderColor: `${config.color}30`,
                                    }}
                                >
                                    {config.label}
                                </Badge>
                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] uppercase font-bold tracking-widest px-3">
                                    {dbUser?.status || 'Active'}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {/* Info Fields */}
                    {isEditing ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="first_name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">First Name</Label>
                                    <Input
                                        id="first_name"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        className="h-11 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 rounded-xl"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="last_name" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Last Name</Label>
                                    <Input
                                        id="last_name"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        className="h-11 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 rounded-xl"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone_number" className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Phone Number</Label>
                                <Input
                                    id="phone_number"
                                    name="phone_number"
                                    value={formData.phone_number}
                                    onChange={handleChange}
                                    className="h-11 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 rounded-xl"
                                />
                            </div>
                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                <Button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs gradient-primary hover:glow-primary"
                                >
                                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Save Changes
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsEditing(false)}
                                    className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { icon: User, label: 'Full Name', value: `${dbUser?.first_name ?? ''} ${dbUser?.last_name ?? ''}`.trim() || 'N/A' },
                                    { icon: Mail, label: 'Email', value: dbUser?.email || 'N/A' },
                                    { icon: Phone, label: 'Phone Number', value: dbUser?.phone_number || 'N/A' },
                                    { icon: Calendar, label: 'Member Since', value: dbUser?.created_at ? formatDate(dbUser.created_at) : 'N/A' },
                                ].map(({ icon: Icon, label, value }) => (
                                    <div
                                        key={label}
                                        className="flex items-center gap-4 bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 p-4 rounded-xl"
                                    >
                                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-white/5 flex items-center justify-center border border-slate-200 dark:border-white/10 shrink-0">
                                            <Icon className="w-5 h-5 text-slate-400" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm">{value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-5 mt-1 border-t border-slate-100 dark:border-white/5">
                                <Button
                                    onClick={() => setIsEditing(true)}
                                    variant="outline"
                                    className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs"
                                >
                                    Edit Profile
                                </Button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Security Card */}
            <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-56 h-56 bg-cyan-500/5 dark:bg-cyan-500/8 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                        <Shield className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Security</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Manage your password</p>
                    </div>
                </div>

                <div className="relative z-10">
                    {isChangingPassword ? (
                        <div className="space-y-4 max-w-md">
                            {[
                                { id: 'currentPassword', label: 'Current Password', key: 'currentPassword' as const },
                                { id: 'newPassword', label: 'New Password', key: 'newPassword' as const },
                                { id: 'confirmPassword', label: 'Confirm New Password', key: 'confirmPassword' as const },
                            ].map(({ id, label, key }) => (
                                <div key={id} className="space-y-2">
                                    <Label htmlFor={id} className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                        {label}
                                    </Label>
                                    <Input
                                        id={id}
                                        type="password"
                                        value={passwordData[key]}
                                        onChange={(e) => setPasswordData(prev => ({ ...prev, [key]: e.target.value }))}
                                        className="h-11 bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10 rounded-xl"
                                    />
                                </div>
                            ))}
                            <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
                                <Button
                                    onClick={handlePasswordChange}
                                    disabled={passwordSaving}
                                    className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs bg-gradient-to-r from-cyan-600 to-blue-600 text-white border-0 hover:from-cyan-500 hover:to-blue-500"
                                >
                                    {passwordSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                    Change Password
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setIsChangingPassword(false)}
                                    className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <Button
                            onClick={() => setIsChangingPassword(true)}
                            variant="outline"
                            className="h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs"
                        >
                            Change Password
                        </Button>
                    )}
                </div>
            </div>

            {/* Log Out */}
            <div className="rounded-2xl p-6 border border-slate-200 dark:border-white/5 bg-white dark:bg-black/40 backdrop-blur-md shadow-sm dark:shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-56 h-56 bg-red-500/5 dark:bg-red-500/8 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                        <LogOut className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Account Session</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Securely end your current session</p>
                    </div>
                </div>

                <div className="relative z-10">
                    <Button
                        variant="ghost"
                        onClick={signOut}
                        className={cn(
                            'h-11 px-6 rounded-xl font-bold uppercase tracking-widest text-xs border',
                            'bg-slate-50 dark:bg-black/40 border-slate-200 dark:border-white/10',
                            'text-slate-600 dark:text-slate-300',
                            'hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-200 dark:hover:border-red-500/20',
                        )}
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sign Out
                    </Button>
                </div>
            </div>
        </div>
    )
}
