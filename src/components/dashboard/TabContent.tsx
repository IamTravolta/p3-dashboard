'use client'

import { useDashboardStore }  from '@/lib/store'
import dynamic               from 'next/dynamic'

// Lazy-load tabs so they don't bloat the initial bundle
const SignalsView    = dynamic(() => import('@/components/signals/SignalsView'),       { loading: () => <Skeleton /> })
const PaperTradesView= dynamic(() => import('@/components/paperTrades/PaperTradesView'), { loading: () => <Skeleton /> })
const ThesisView     = dynamic(() => import('@/components/thesis/ThesisView'),         { loading: () => <Skeleton /> })
const BehavioralView = dynamic(() => import('@/components/behavioral/BehavioralView'), { loading: () => <Skeleton /> })
const SettingsView   = dynamic(() => import('@/components/settings/SettingsView'),     { loading: () => <Skeleton /> })
const BriefingView   = dynamic(() => import('@/components/briefing/BriefingView'),     { loading: () => <Skeleton /> })

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-4">
      <div className="h-6 w-48 rounded bg-zinc-800" />
      <div className="h-32 w-full rounded bg-zinc-800/60" />
      <div className="h-20 w-full rounded bg-zinc-800/40" />
    </div>
  )
}

export default function TabContent() {
  const activeTab = useDashboardStore((s) => s.activeTab)

  if (activeTab === 'signals')    return <SignalsView />
  if (activeTab === 'paper')      return <PaperTradesView />
  if (activeTab === 'thesis')     return <ThesisView />
  if (activeTab === 'behavioral') return <BehavioralView />
  if (activeTab === 'settings')   return <SettingsView />
  if (activeTab === 'briefing')   return <BriefingView />

  return null
}
