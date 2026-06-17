'use client'

import { cn } from '@/lib/utils'

/**
 * Modern notification bell. Rounded custom glyph with a soft glow + gentle
 * swing when there are unread items, and a refined count badge.
 */
export function NotificationBell({ count = 0, className }: { count?: number; className?: string }) {
    const active = count > 0
    return (
        <span className={cn('relative inline-flex items-center justify-center', className)}>
            <style>{`
                @keyframes gpBellSwing {
                    0%,100% { transform: rotate(0deg); }
                    10% { transform: rotate(14deg); }
                    20% { transform: rotate(-11deg); }
                    30% { transform: rotate(8deg); }
                    40% { transform: rotate(-6deg); }
                    50% { transform: rotate(3deg); }
                    60% { transform: rotate(0deg); }
                }
                @keyframes gpBadgePop {
                    0% { transform: scale(0); }
                    60% { transform: scale(1.25); }
                    100% { transform: scale(1); }
                }
            `}</style>

            {active && (
                <span className="absolute inset-0 -m-1 rounded-full bg-primary/20 blur-[6px] animate-pulse pointer-events-none" />
            )}

            <svg
                viewBox="0 0 24 24"
                fill="none"
                className={cn('w-[22px] h-[22px] relative', active && 'text-primary')}
                style={active ? { transformOrigin: 'top center', animation: 'gpBellSwing 2.2s ease-in-out infinite' } : undefined}
            >
                <path
                    d="M12 3a6 6 0 0 0-6 6v3.6c0 .5-.2 1-.55 1.38L4.1 15.4c-.62.66-.15 1.74.75 1.74h14.3c.9 0 1.37-1.08.75-1.74l-1.35-1.42A2 2 0 0 1 18 12.6V9a6 6 0 0 0-6-6Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                    className={active ? 'fill-primary/10' : ''}
                />
                <path
                    d="M9.5 19a2.5 2.5 0 0 0 5 0"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                />
            </svg>

            {active && (
                <span
                    className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-background bg-gradient-to-br from-primary to-indigo-500 text-white shadow-[0_0_8px_rgba(225,0,255,0.5)]"
                    style={{ animation: 'gpBadgePop 0.3s ease-out' }}
                >
                    {count > 9 ? '9+' : count}
                </span>
            )}
        </span>
    )
}
