import { NextRequest, NextResponse } from 'next/server'
import { sendWelcomeEmail, sendAdminNewUserAlert } from '@/lib/email-service'
import { sendWelcomeSMS } from '@/lib/sms-service'
import { getWelcomeEmailRatelimit, resetRatelimitSingletons } from '@/lib/rate-limit'

/**
 * API route to send welcome email after user signup.
 * Also sends admin notification about new user registration.
 * This is called from the client after successful signup.
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limit by client IP — this endpoint is unauthenticated and would
        // otherwise let anyone spam emails/SMS and drain provider quota.
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown'
        try {
            const { success } = await getWelcomeEmailRatelimit().limit(ip)
            if (!success) {
                return NextResponse.json(
                    { error: 'Too many requests. Please try again later.' },
                    { status: 429 }
                )
            }
        } catch (rlErr) {
            // Fail open on infra issues, but reset the connection for next time
            console.error('[WelcomeEmail] Rate limit check failed, failing open:', rlErr)
            resetRatelimitSingletons()
        }

        const body = await request.json()
        const { email, firstName, lastName, phoneNumber } = body

        if (!email || !firstName) {
            return NextResponse.json(
                { error: 'Email and firstName are required' },
                { status: 400 }
            )
        }

        // Send welcome email to user
        const welcomeResult = await sendWelcomeEmail(email, firstName)

        if (!welcomeResult.success) {
            console.error('[WelcomeEmail] Failed to send:', welcomeResult.error)
        }

        // Send welcome SMS to user (non-blocking)
        if (phoneNumber) {
            sendWelcomeSMS(phoneNumber, firstName)
                .catch((err: Error) => console.error('[WelcomeEmail] Welcome SMS failed:', err))
        }

        // Send admin notification about new user (non-blocking)
        sendAdminNewUserAlert({
            firstName,
            lastName: lastName || '',
            email,
            phoneNumber: phoneNumber || 'Not provided'
        }).catch((err: Error) => console.error('[WelcomeEmail] Admin notification failed:', err))

        return NextResponse.json({
            success: true,
            messageId: welcomeResult.messageId
        })
    } catch (error: any) {
        console.error('[WelcomeEmail] Error:', error)
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        )
    }
}
