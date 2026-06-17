import { GamerLoader } from '@/components/ui/gamer-loader'

// Instant loading state for all admin routes (shown while the page segment
// loads). The admin sidebar + header persist; this fills the content area.
export default function AdminLoading() {
    return <GamerLoader />
}
