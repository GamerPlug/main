import { NextResponse } from 'next/server'

// Agent expiry has been removed — agents no longer expire
export async function GET() {
    return NextResponse.json({ message: 'Agent renewal reminders are disabled. Roles are permanent.', sent: 0 })
}
