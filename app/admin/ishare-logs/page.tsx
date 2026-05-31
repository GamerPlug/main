'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Loader2, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export default function AdminIShareLogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [autoFulfillEnabled, setAutoFulfillEnabled] = useState(false)
    const [savingToggle, setSavingToggle] = useState(false)

    useEffect(() => {
        fetchSetting()
        fetchLogs()
    }, [])

    // Real-time subscription for live log updates
    useEffect(() => {
        const channel = (supabase as any)
            .channel('admin-ishare-logs')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ishare_fulfillment_logs' }, () => {
                fetchLogs()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
                fetchLogs()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [])

    const fetchSetting = async () => {
        const { data } = await (supabase
            .from('admin_settings') as any)
            .select('value')
            .eq('key', 'ishare_auto_fulfillment_enabled')
            .single()

        if (data) {
            setAutoFulfillEnabled(data.value === 'true')
        }
    }

    const fetchLogs = async () => {
        setLoading(true)
        const { data } = await (supabase
            .from('ishare_fulfillment_logs') as any)
            .select(`
                *,
                orders (
                    reference_code,
                    phone_number,
                    size,
                    network
                )
            `)
            .order('created_at', { ascending: false })
            .limit(100)

        setLogs(data || [])
        setLoading(false)
    }

    const saveToggle = async (value: boolean) => {
        setSavingToggle(true)
        try {
            const { error } = await (supabase
                .from('admin_settings') as any)
                .upsert({ key: 'ishare_auto_fulfillment_enabled', value: String(value) })

            if (error) throw error

            setAutoFulfillEnabled(value)
            toast.success(
                value
                    ? 'iShare auto-fulfillment enabled — orders will be fulfilled via SPFastIT API and hidden from manual download'
                    : 'iShare auto-fulfillment disabled — orders will appear in the manual download list'
            )
        } catch {
            toast.error('Failed to save setting')
        } finally {
            setSavingToggle(false)
        }
    }

    const statusBadgeVariant = (status: string) => {
        if (status === 'success') return 'completed' as const
        if (status === 'failed') return 'failed' as const
        return 'secondary' as const
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">iShare Fulfillment Logs</h1>
                <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {/* Auto-Fulfillment Toggle Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Auto-Fulfillment Control</CardTitle>
                    <CardDescription>
                        When enabled, AT-iShare orders are automatically fulfilled via the SPFastIT API upon payment.
                        They will also be hidden from the manual download list.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="space-y-0.5">
                            <Label className="text-base font-semibold">Enable iShare Auto-Fulfillment</Label>
                            <p className="text-sm text-muted-foreground">
                                {autoFulfillEnabled
                                    ? 'ON — iShare orders are processed via API and hidden from manual download'
                                    : 'OFF — iShare orders require manual download and processing'}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            {savingToggle && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                            <Switch
                                checked={autoFulfillEnabled}
                                onCheckedChange={saveToggle}
                                disabled={savingToggle}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Fulfillment Log</CardTitle>
                    <CardDescription>Most recent 100 iShare fulfillment attempts</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : logs.length === 0 ? (
                        <p className="text-center text-muted-foreground py-12 text-sm">
                            No fulfillment logs yet. Logs will appear here once auto-fulfillment is triggered.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Order Ref</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Bundle MB</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Error / Response</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {logs.map((log) => (
                                    <TableRow key={log.id}>
                                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                            {formatDate(log.created_at)}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {log.orders?.reference_code ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {log.phone_number ?? log.orders?.phone_number ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-sm">
                                            {log.orders?.size ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-sm font-mono">
                                            {log.bundle_mb ? `${log.bundle_mb} MB` : '—'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={statusBadgeVariant(log.status)}>
                                                {log.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-xs text-xs text-muted-foreground truncate">
                                            {log.error_reason ?? (log.api_response ? JSON.stringify(log.api_response) : '—')}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
