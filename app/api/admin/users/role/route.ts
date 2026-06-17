import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { sendRoleUpgradeSuccessSMS } from '@/lib/sms-service'
import { createNotification, roleChangeNotification } from '@/lib/notification-service'

const ROLE_RANK: Record<string, number> = {
    user: 1, agent: 2, 'super agent': 2.5, dealer: 3, 'super dealer': 3.5, platinum: 3.8, 'sub-admin': 4, admin: 5,
}

export async function POST(request: NextRequest) {
    try {
        const cookieStore = await cookies()
        const supabaseUserClient = createRouteHandlerClient({
            // @ts-expect-error - auth-helpers types expect Promise but runtime needs synchronous object
            cookies: () => cookieStore
        })
        const { data: { session }, error: sessionError } = await supabaseUserClient.auth.getSession()

        if (sessionError || !session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if requester is admin
        const { data: userData } = await supabaseUserClient
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (userData?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { userId, role } = body
        console.log(`[AdminRoleUpdate] Attempting to update user ${userId} to role: ${role}`)

        if (!userId || !role) {
            return NextResponse.json({ error: 'userId and role are required' }, { status: 400 })
        }

        // Service role client to bypass RLS
        const supabase = createServerClient()

        // Capture the previous role so we can tell the user up- vs down-grade.
        const { data: prevUser } = await (supabase
            .from('users') as any)
            .select('role')
            .eq('id', userId)
            .single()
        const previousRole = prevUser?.role

        const updateData: any = { role }

        const { error: updateError } = await (supabase
            .from('users') as any)
            .update(updateData)
            .eq('id', userId)

        if (updateError) {
            console.error('[AdminRoleUpdate] Update error:', updateError)
            throw updateError
        }

        // Notify the user of their role change (in-app + best-effort push).
        if (previousRole !== role) {
            const direction = (ROLE_RANK[role] ?? 0) >= (ROLE_RANK[previousRole] ?? 0) ? 'upgraded' : 'downgraded'
            await createNotification({
                userId,
                ...roleChangeNotification(role, direction),
            }).catch((e) => console.error('[AdminRoleUpdate] Notification error:', e))
        }

        // Send SMS notification if user was upgraded to agent or dealer
        if (role === 'agent' || role === 'dealer') {
            try {
                // Fetch user details for SMS
                const { data: userDetails } = await (supabase
                    .from('users') as any)
                    .select('phone_number, first_name')
                    .eq('id', userId)
                    .single()

                if (userDetails?.phone_number) {
                    await sendRoleUpgradeSuccessSMS(
                        userDetails.phone_number,
                        userDetails.first_name || 'User',
                        role
                    )
                    console.log(`[AdminRoleUpdate] ${role} activation SMS sent to ${userDetails.phone_number}`)
                } else {
                    console.warn(`[AdminRoleUpdate] No phone number for user ${userId}`)
                }
            } catch (smsError) {
                console.error('[AdminRoleUpdate] SMS error:', smsError)
                // Don't fail the request if SMS fails
            }
        }

        return NextResponse.json({
            success: true,
            userId,
            newRole: role
        })
    } catch (error: any) {
        console.error('Admin Role Update Error:', error)
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
    }
}
