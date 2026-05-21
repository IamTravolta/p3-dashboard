'use client'

import { useDashboardStore } from '@/lib/store'
import dynamic              from 'next/dynamic'

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-4">
      <div className="h-6 w-48 rounded bg-zinc-800" />
      <div className="h-32 w-full rounded bg-zinc-800/60" />
      <div className="h-20 w-full rounded bg-zinc-800/40" />
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
const DashboardHomeView   = dynamic(() => import('@/components/dashboard/DashboardHomeView'),    { loading: () => <Skeleton /> })

// ── Action Center ─────────────────────────────────────────────────────────────
const ActionCenterView    = dynamic(() => import('@/components/actionCenter/ActionCenterView'),  { loading: () => <Skeleton /> })

// ── Per Ticker ────────────────────────────────────────────────────────────────
const TickerUnifiedView   = dynamic(() => import('@/components/ticker/TickerUnifiedView'),       { loading: () => <Skeleton /> })

// ── Portfolio group (combined views) ─────────────────────────────────────────
const PositionsHubView    = dynamic(() => import('@/components/positions/PositionsHubView'),     { loading: () => <Skeleton /> })
const RiskSizingView      = dynamic(() => import('@/components/positions/RiskSizingView'),       { loading: () => <Skeleton /> })
const TimingView          = dynamic(() => import('@/components/positions/TimingView'),            { loading: () => <Skeleton /> })

// ── Pipeline group ────────────────────────────────────────────────────────────
const PipelineUnifiedView = dynamic(() => import('@/components/pipeline/PipelineUnifiedView'),   { loading: () => <Skeleton /> })
const ValidatorView       = dynamic(() => import('@/components/research/ValidatorView'),          { loading: () => <Skeleton /> })
const BigMoneyView        = dynamic(() => import('@/components/pipeline/BigMoneyView'),           { loading: () => <Skeleton /> })
const EarningsView        = dynamic(() => import('@/components/research/EarningsView'),           { loading: () => <Skeleton /> })
const ResearchView        = dynamic(() => import('@/components/pipeline/ResearchView'),           { loading: () => <Skeleton /> })

// ── Learnings group ───────────────────────────────────────────────────────────
const LearningsHubView    = dynamic(() => import('@/components/learnings/LearningsHubView'),     { loading: () => <Skeleton /> })
const PaperTradesView     = dynamic(() => import('@/components/paperTrades/PaperTradesView'),     { loading: () => <Skeleton /> })
const BacktestView        = dynamic(() => import('@/components/learnings/BacktestView'),          { loading: () => <Skeleton /> })
const SourcesView         = dynamic(() => import('@/components/learnings/SourcesView'),           { loading: () => <Skeleton /> })

// ── Standalone ────────────────────────────────────────────────────────────────
const BriefingView        = dynamic(() => import('@/components/briefing/BriefingView'),           { loading: () => <Skeleton /> })
const SettingsView        = dynamic(() => import('@/components/settings/SettingsView'),            { loading: () => <Skeleton /> })

export default function TabContent() {
  const activeGroup  = useDashboardStore((s) => s.activeGroup)
  const activeSubTab = useDashboardStore((s) => s.activeSubTab)

  // ── Dashboard ─────────────────────────────────────────────
  if (activeGroup === 'dashboard' || activeSubTab === 'dashboard-home') return <DashboardHomeView />

  // ── Action Center ─────────────────────────────────────────
  if (activeGroup === 'action') return <ActionCenterView />

  // ── Per Ticker ────────────────────────────────────────────
  if (activeGroup === 'ticker') return <TickerUnifiedView />

  // ── Portfolio ─────────────────────────────────────────────
  if (activeGroup === 'portfolio') {
    if (activeSubTab === 'risk-sizing') return <RiskSizingView />
    if (activeSubTab === 'timing')      return <TimingView />
    return <PositionsHubView /> // default: positions
  }

  // ── Pipeline ──────────────────────────────────────────────
  if (activeGroup === 'pipeline') {
    if (activeSubTab === 'validator')        return <ValidatorView />
    if (activeSubTab === 'bigmoney')         return <BigMoneyView />
    if (activeSubTab === 'earnings')         return <EarningsView />
    if (activeSubTab === 'research')         return <ResearchView />
    return <PipelineUnifiedView /> // default: pipeline-unified
  }

  // ── Learnings ─────────────────────────────────────────────
  if (activeGroup === 'learnings') {
    if (activeSubTab === 'paper')    return <PaperTradesView />
    if (activeSubTab === 'backtest') return <BacktestView />
    if (activeSubTab === 'sources')  return <SourcesView />
    return <LearningsHubView /> // default: learnings-hub
  }

  // ── Briefing / Settings ───────────────────────────────────
  if (activeGroup === 'briefing') return <BriefingView />
  if (activeGroup === 'settings') return <SettingsView />

  return null
}
