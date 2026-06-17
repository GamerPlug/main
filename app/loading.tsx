import { GamerLoader } from '@/components/ui/gamer-loader'

// Global instant loading state for top-level route segments.
export default function RootLoading() {
    return <GamerLoader fullScreen />
}
