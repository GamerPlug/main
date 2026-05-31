import { Crown, Star, BadgeCheck, UserCircle, Sparkles, LucideIcon } from 'lucide-react'

export type UserRole = 'admin' | 'sub-admin' | 'super dealer' | 'dealer' | 'super agent' | 'agent' | 'platinum' | 'user'

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
    'sub-admin': {
        icon: Star,
        label: 'Sub-Admin',
        rank: '#2',
        color: '#FACC15',
        bgColor: 'rgba(250, 204, 21, 0.15)',
        textColor: '#B59410'
    },
    'platinum': {
        icon: Sparkles,
        label: 'Platinum',
        rank: '#2.1',
        color: '#00CFE8',
        bgColor: 'rgba(0, 207, 232, 0.1)',
        textColor: '#00CFE8'
    },
    'super dealer': {
        icon: Crown,
        label: 'Super Dealer',
        rank: '#2.3',
        color: '#7367F0',
        bgColor: 'rgba(115, 103, 240, 0.1)',
        textColor: '#7367F0'
    },
    'dealer': {
        icon: Crown,
        label: 'Dealer',
        rank: '#2.5',
        color: '#A855F7',
        bgColor: 'rgba(168, 85, 247, 0.1)',
        textColor: '#A855F7'
    },
    'super agent': {
        icon: BadgeCheck,
        label: 'Super Agent',
        rank: '#2.8',
        color: '#28C76F',
        bgColor: 'rgba(40, 199, 111, 0.1)',
        textColor: '#28C76F'
    },
    'agent': {
        icon: BadgeCheck,
        label: 'Agent',
        rank: '#3',
        color: '#25D366',
        bgColor: 'rgba(37, 211, 102, 0.1)',
        textColor: '#25D366'
    },
    'user': {
        icon: UserCircle,
        label: 'User',
        rank: '#4',
        color: '#0056B3',
        bgColor: 'rgba(0, 86, 179, 0.1)',
        textColor: '#0056B3'
    }
}
