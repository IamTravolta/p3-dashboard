'use client'

import { useDashboardStore } from '@/lib/store'
import TabContent            from './TabContent'

interface TabContentRouterProps {
  portfolioTab: React.ReactNode
  watchlistTab: React.ReactNode
}

export default function TabContentRouter({ portfolioTab, watchlistTab }: TabContentRouterProps) {
  const activeGroup  = useDashboardStore((s) => s.activeGroup)
  const activeSubTab = useDashboardStore((s) => s.activeSubTab)

  if (activeGroup === 'portfolio' && activeSubTab === 'overview') return <>{portfolioTab}</>
  if (activeGroup === 'pipeline' && activeSubTab === 'watchlist') return <>{watchlistTab}</>

  return <TabContent />
}
