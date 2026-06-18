'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Loader2, Save, Settings, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

interface SettingsState {
    paystackFee: string
    agentPaystackFee: string
    mtnAdjustment: string
    agentUpgradePrice: string
    afaPriceUser: string
    afaPriceAgent: string
    supportEmail: string
    contactPhone: string
    contactWhatsApp: string
    contactAddress: string
    whatsappGroupLink: string
    whatsappChannelLink: string
    autoFulfillment: boolean
    walletTopupEnabled: boolean
    pageAccessDashboard: boolean
    pageAccessDataPackages: boolean
    pageAccessOrders: boolean
    pageAccessWallet: boolean
    pageAccessComplaints: boolean
    pageAccessNotifications: boolean
    pageAccessProfile: boolean
}

const DEFAULTS: SettingsState = {
    paystackFee: '1.95',
    agentPaystackFee: '1.95',
    mtnAdjustment: '0',
    agentUpgradePrice: '100',
    afaPriceUser: '15',
    afaPriceAgent: '15',
    supportEmail: '',
    contactPhone: '',
    contactWhatsApp: '',
    contactAddress: '',
    whatsappGroupLink: '',
    whatsappChannelLink: '',
    autoFulfillment: true,
    walletTopupEnabled: true,
    pageAccessDashboard: true,
    pageAccessDataPackages: true,
    pageAccessOrders: true,
    pageAccessWallet: true,
    pageAccessComplaints: true,
    pageAccessNotifications: true,
    pageAccessProfile: true,
}

function settingsFromMap(map: Record<string, string>): SettingsState {
    return {
        paystackFee: map.paystack_fee_percent ?? DEFAULTS.paystackFee,
        agentPaystackFee: map.agent_paystack_fee_percent ?? DEFAULTS.agentPaystackFee,
        mtnAdjustment: map.mtn_price_adjustment ?? DEFAULTS.mtnAdjustment,
        agentUpgradePrice: map.agent_upgrade_price ?? DEFAULTS.agentUpgradePrice,
        afaPriceUser: map.afa_price_user ?? DEFAULTS.afaPriceUser,
        afaPriceAgent: map.afa_price_agent ?? DEFAULTS.afaPriceAgent,
        supportEmail: map.support_email ?? '',
        contactPhone: map.contact_phone ?? '',
        contactWhatsApp: map.contact_whatsapp ?? '',
        contactAddress: map.contact_address ?? '',
        whatsappGroupLink: map.whatsapp_group_link ?? '',
        whatsappChannelLink: map.whatsapp_channel_link ?? '',
        // Bug fix: use !== 'false' consistently so missing keys default to true
        autoFulfillment: map.auto_fulfillment_enabled !== 'false',
        walletTopupEnabled: map.wallet_topup_enabled !== 'false',
        pageAccessDashboard: map.page_access_dashboard !== 'false',
        pageAccessDataPackages: map.page_access_data_packages !== 'false',
        pageAccessOrders: map.page_access_orders !== 'false',
        pageAccessWallet: map.page_access_wallet !== 'false',
        pageAccessComplaints: map.page_access_complaints !== 'false',
        pageAccessNotifications: map.page_access_notifications !== 'false',
        pageAccessProfile: map.page_access_profile !== 'false',
    }
}

function settingsToUpsert(s: SettingsState) {
    return [
        { key: 'paystack_fee_percent', value: s.paystackFee },
        { key: 'agent_paystack_fee_percent', value: s.agentPaystackFee },
        { key: 'mtn_price_adjustment', value: s.mtnAdjustment },
        { key: 'agent_upgrade_price', value: s.agentUpgradePrice },
        { key: 'afa_price_user', value: s.afaPriceUser },
        { key: 'afa_price_agent', value: s.afaPriceAgent },
        { key: 'support_email', value: s.supportEmail },
        { key: 'contact_phone', value: s.contactPhone },
        { key: 'contact_whatsapp', value: s.contactWhatsApp },
        { key: 'contact_address', value: s.contactAddress },
        { key: 'whatsapp_group_link', value: s.whatsappGroupLink },
        { key: 'whatsapp_channel_link', value: s.whatsappChannelLink },
        { key: 'auto_fulfillment_enabled', value: String(s.autoFulfillment) },
        { key: 'wallet_topup_enabled', value: String(s.walletTopupEnabled) },
        { key: 'page_access_dashboard', value: String(s.pageAccessDashboard) },
        { key: 'page_access_data_packages', value: String(s.pageAccessDataPackages) },
        { key: 'page_access_orders', value: String(s.pageAccessOrders) },
        { key: 'page_access_wallet', value: String(s.pageAccessWallet) },
        { key: 'page_access_complaints', value: String(s.pageAccessComplaints) },
        { key: 'page_access_notifications', value: String(s.pageAccessNotifications) },
        { key: 'page_access_profile', value: String(s.pageAccessProfile) },
    ]
}

function ToggleRow({
    label,
    description,
    checked,
    onCheckedChange,
    id,
}: {
    label: string
    description: string
    checked: boolean
    onCheckedChange: (v: boolean) => void
    id: string
}) {
    return (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-white hover:bg-slate-50 transition-colors">
            <div className="space-y-0.5 flex-1 mr-4">
                <div className="flex items-center gap-2">
                    <Label htmlFor={id} className="text-sm font-medium cursor-pointer">{label}</Label>
                    <Badge variant={checked ? 'default' : 'secondary'} className="text-xs h-4 px-1.5">
                        {checked ? 'On' : 'Off'}
                    </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
        </div>
    )
}

export default function AdminSettingsPage() {
    const [form, setForm] = useState<SettingsState>(DEFAULTS)
    const [saved, setSaved] = useState<SettingsState>(DEFAULTS)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    const hasChanges = JSON.stringify(form) !== JSON.stringify(saved)

    const set = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }))
    }, [])

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const { data, error } = await (supabase
                .from('admin_settings') as any)
                .select('key, value')

            if (error) throw error

            const map: Record<string, string> = (data ?? []).reduce(
                (acc: Record<string, string>, curr: { key: string; value: string }) => {
                    acc[curr.key] = curr.value
                    return acc
                },
                {}
            )

            const loaded = settingsFromMap(map)
            setForm(loaded)
            setSaved(loaded)
        } catch (error) {
            console.error('Error fetching settings:', error)
            toast.error('Failed to load settings')
        } finally {
            setLoading(false)
        }
    }

    const saveSettings = async () => {
        setSaving(true)
        try {
            // Bug fix: onConflict: 'key' ensures upsert updates existing rows instead of inserting duplicates
            const { error } = await (supabase
                .from('admin_settings') as any)
                .upsert(settingsToUpsert(form), { onConflict: 'key' })

            if (error) throw error

            setSaved(form)
            toast.success('Settings saved successfully')
        } catch (error) {
            console.error('Error saving settings:', error)
            toast.error('Failed to save settings')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="p-12 flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="animate-spin w-6 h-6" />
                <p className="text-sm">Loading settings…</p>
            </div>
        )
    }

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center flex-shrink-0">
                        <Settings className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Platform Settings</h1>
                        <p className="text-sm text-muted-foreground">Configure platform parameters and access controls</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {hasChanges && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Unsaved
                        </Badge>
                    )}
                    <Button onClick={saveSettings} disabled={saving || !hasChanges} size="sm">
                        {saving ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        {saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="general">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="general">General</TabsTrigger>
                    <TabsTrigger value="fees">Fees & Pricing</TabsTrigger>
                    <TabsTrigger value="fulfillment">Fulfillment</TabsTrigger>
                    <TabsTrigger value="access">Page Access</TabsTrigger>
                </TabsList>

                {/* ── General ── */}
                <TabsContent value="general" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Support Information</CardTitle>
                            <CardDescription>Contact details displayed to users across the platform</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="support-email">Support Email</Label>
                                <Input
                                    id="support-email"
                                    type="email"
                                    value={form.supportEmail}
                                    onChange={e => set('supportEmail', e.target.value)}
                                    placeholder="support@gamerplug.com"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="contact-phone">Contact Phone</Label>
                                    <Input
                                        id="contact-phone"
                                        value={form.contactPhone}
                                        onChange={e => set('contactPhone', e.target.value)}
                                        placeholder="+233 24 123 4567"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="contact-whatsapp">WhatsApp Number</Label>
                                    <Input
                                        id="contact-whatsapp"
                                        value={form.contactWhatsApp}
                                        onChange={e => set('contactWhatsApp', e.target.value)}
                                        placeholder="233241234567"
                                    />
                                    <p className="text-xs text-muted-foreground">Digits only, with country code (e.g. 233…)</p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="contact-address">Contact Address</Label>
                                <Input
                                    id="contact-address"
                                    value={form.contactAddress}
                                    onChange={e => set('contactAddress', e.target.value)}
                                    placeholder="Accra, Ghana"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Community Links</CardTitle>
                            <CardDescription>WhatsApp links shown to users for community access</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="wa-group">WhatsApp Group Link</Label>
                                <Input
                                    id="wa-group"
                                    value={form.whatsappGroupLink}
                                    onChange={e => set('whatsappGroupLink', e.target.value)}
                                    placeholder="https://chat.whatsapp.com/..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="wa-channel">WhatsApp Channel Link</Label>
                                <Input
                                    id="wa-channel"
                                    value={form.whatsappChannelLink}
                                    onChange={e => set('whatsappChannelLink', e.target.value)}
                                    placeholder="https://whatsapp.com/channel/..."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Feature Toggles</CardTitle>
                            <CardDescription>Enable or disable user-facing platform features</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <ToggleRow
                                id="wallet-topup"
                                label="Wallet Top-up"
                                description="Allow users to fund their wallets via Paystack"
                                checked={form.walletTopupEnabled}
                                onCheckedChange={v => set('walletTopupEnabled', v)}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Fees & Pricing ── */}
                <TabsContent value="fees" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Paystack Fees</CardTitle>
                            <CardDescription>Transaction fees added during wallet top-up</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="paystack-fee">Regular User Fee (%)</Label>
                                    <Input
                                        id="paystack-fee"
                                        type="number"
                                        value={form.paystackFee}
                                        onChange={e => set('paystackFee', e.target.value)}
                                        step="0.01"
                                        min="0"
                                        max="10"
                                    />
                                    <p className="text-xs text-muted-foreground">Passed on to regular users</p>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="agent-paystack-fee">Agent Fee (%)</Label>
                                    <Input
                                        id="agent-paystack-fee"
                                        type="number"
                                        value={form.agentPaystackFee}
                                        onChange={e => set('agentPaystackFee', e.target.value)}
                                        step="0.01"
                                        min="0"
                                        max="10"
                                    />
                                    <p className="text-xs text-muted-foreground">Passed on to agents</p>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="mtn-adjustment">MTN Price Adjustment (GHS)</Label>
                                <Input
                                    id="mtn-adjustment"
                                    type="number"
                                    value={form.mtnAdjustment}
                                    onChange={e => set('mtnAdjustment', e.target.value)}
                                    step="0.01"
                                />
                                <p className="text-xs text-muted-foreground">Additional markup applied to all MTN packages</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Agent Upgrade</CardTitle>
                            <CardDescription>One-time fee to upgrade a user account to agent tier</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-1.5">
                                <Label htmlFor="agent-upgrade-price">Agent Upgrade Price (GHS)</Label>
                                <Input
                                    id="agent-upgrade-price"
                                    type="number"
                                    value={form.agentUpgradePrice}
                                    onChange={e => set('agentUpgradePrice', e.target.value)}
                                    step="1"
                                    min="0"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">AFA Application Fees</CardTitle>
                            <CardDescription>Fees for Authorized Field Agent registration applications</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="afa-user">User Application Fee (GHS)</Label>
                                    <Input
                                        id="afa-user"
                                        type="number"
                                        value={form.afaPriceUser}
                                        onChange={e => set('afaPriceUser', e.target.value)}
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="afa-agent">Agent Application Fee (GHS)</Label>
                                    <Input
                                        id="afa-agent"
                                        type="number"
                                        value={form.afaPriceAgent}
                                        onChange={e => set('afaPriceAgent', e.target.value)}
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Fulfillment ── */}
                <TabsContent value="fulfillment" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Order Fulfillment</CardTitle>
                            <CardDescription>Control how orders are processed and delivered</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <ToggleRow
                                id="auto-fulfillment"
                                label="Auto-Fulfillment"
                                description="Automatically process and fulfill orders via provider APIs without manual intervention"
                                checked={form.autoFulfillment}
                                onCheckedChange={v => set('autoFulfillment', v)}
                            />
                            {!form.autoFulfillment && (
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
                                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                    <p>Auto-fulfillment is disabled. All orders will require manual processing by an admin.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* ── Page Access ── */}
                <TabsContent value="access" className="space-y-4 mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Page Access Control</CardTitle>
                            <CardDescription>
                                Toggle which pages non-admin users can access. Admins always have full access.
                                Disabled pages are hidden from navigation and blocked on direct visit.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <ToggleRow
                                id="access-dashboard"
                                label="Dashboard / Home"
                                description="Main overview page with stats and activity"
                                checked={form.pageAccessDashboard}
                                onCheckedChange={v => set('pageAccessDashboard', v)}
                            />
                            <ToggleRow
                                id="access-data-packages"
                                label="Data Packages"
                                description="Browse and purchase data bundles"
                                checked={form.pageAccessDataPackages}
                                onCheckedChange={v => set('pageAccessDataPackages', v)}
                            />
                            <ToggleRow
                                id="access-orders"
                                label="Orders"
                                description="View order history and track status"
                                checked={form.pageAccessOrders}
                                onCheckedChange={v => set('pageAccessOrders', v)}
                            />
                            <ToggleRow
                                id="access-wallet"
                                label="Wallet"
                                description="Check balance and top up via Paystack"
                                checked={form.pageAccessWallet}
                                onCheckedChange={v => set('pageAccessWallet', v)}
                            />
                            <ToggleRow
                                id="access-complaints"
                                label="Complaints"
                                description="Submit and track support complaints"
                                checked={form.pageAccessComplaints}
                                onCheckedChange={v => set('pageAccessComplaints', v)}
                            />
                            <ToggleRow
                                id="access-notifications"
                                label="Notifications"
                                description="View system and account notifications"
                                checked={form.pageAccessNotifications}
                                onCheckedChange={v => set('pageAccessNotifications', v)}
                            />
                            <ToggleRow
                                id="access-profile"
                                label="Profile"
                                description="View and edit account profile"
                                checked={form.pageAccessProfile}
                                onCheckedChange={v => set('pageAccessProfile', v)}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}
