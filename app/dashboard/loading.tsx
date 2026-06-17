import { GamerLoader } from '@/components/ui/gamer-loader'

// Instant loading state for all dashboard routes (shown while the page
// segment loads). The sidebar + header persist; this fills the content area.
export default function DashboardLoading() {
    return <GamerLoader />
}
