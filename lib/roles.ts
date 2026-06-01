import { Crown, BadgeCheck, UserCircle, LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'dealer' | 'agent'

interface RoleConfigItem {
    icon: LucideIcon
    label: string
    rank: string
    color: string
    bgColor: string
    textColor: string
}

export const roleConfig: Record<UserRole, RoleConfigItem> = {
    'admin': {
        icon: Crown,
        label: 'Admin',
        rank: '#1',
        color: '#E60000',
        bgColor: 'rgba(230, 0, 0, 0.1)',
        textColor: '#E60000'
    },
    'dealer': {
        icon: Crown,
        label: 'Dealer',
        rank: '#2',
        color: '#A855F7',
        bgColor: 'rgba(168, 85, 247, 0.1)',
        textColor: '#A855F7'
    },
    'agent': {
        icon: BadgeCheck,
        label: 'Agent',
        rank: '#3',
        color: '#25D366',
        bgColor: 'rgba(37, 211, 102, 0.1)',
        textColor: '#25D366'
    },
}
