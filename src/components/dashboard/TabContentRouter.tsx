'use client'

/**
 * Routes the main content area based on the active tab in the Zustand store.
 *
 * Portfolio and Watchlist are passed as pre-rendered React nodes (server components),
 * so they benefit from Next.js server-side prefetching.
 *
 * All other tabs are lazy-loaded client components.
 */

import { useDashboardStore } from '@/lib/store'
import TabContent            from './TabContent'

interface TabContentRouterProps {
  portfolioTab: React.ReactNode
  watchlistTab: React.ReactNode
}

export default function TabContentRouter({ portfolioTab, watchlistTab }: TabContentRouterProps) {
  const activeTab = useDashboardStore((s) => s.activeTab)

  if (activeTab === 'portfolio') return <>{portfolioTab}</>
  if (activeTab === 'watchlist') return <>{watchlistTab}</>

  return <TabContent />
}
