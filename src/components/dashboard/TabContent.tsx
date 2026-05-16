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

const opts = { loading: () => <Skeleton /> }

// ── Portfolio group ───────────────────────────────────────────────────────────
const ActionCenterView   = dynamic(() => import('@/components/actionCenter/ActionCenterView'),   opts)
const MyPositionsView    = dynamic(() => import('@/components/positions/MyPositionsView'),       opts)
const SizingView         = dynamic(() => import('@/components/positions/SizingView'),            opts)
const CatalystView       = dynamic(() => import('@/components/positions/CatalystView'),          opts)
const HedgeView          = dynamic(() => import('@/components/positions/HedgeView'),             opts)
const OptionsView        = dynamic(() => import('@/components/research/OptionsView'),            opts)

// ── Pipeline group ────────────────────────────────────────────────────────────
const TradeIdeasView     = dynamic(() => import('@/components/research/TradeIdeasView'),         opts)
const ValidatorView      = dynamic(() => import('@/components/research/ValidatorView'),          opts)
const InsiderFlowView    = dynamic(() => import('@/components/research/InsiderFlowView'),        opts)
const SmartMoneyView     = dynamic(() => import('@/components/research/SmartMoneyView'),         opts)
const EarningsView       = dynamic(() => import('@/components/research/EarningsView'),           opts)
const MomentumView       = dynamic(() => import('@/components/research/MomentumView'),           opts)
const CorrelationsView   = dynamic(() => import('@/components/research/CorrelationsView'),       opts)
const PredictionsView    = dynamic(() => import('@/components/research/PredictionsView'),        opts)

// ── Learnings group ───────────────────────────────────────────────────────────
const SignalsView        = dynamic(() => import('@/components/signals/SignalsView'),             opts)
const PaperTradesView    = dynamic(() => import('@/components/paperTrades/PaperTradesView'),     opts)
const ThesisView         = dynamic(() => import('@/components/thesis/ThesisView'),               opts)
const BehavioralView     = dynamic(() => import('@/components/behavioral/BehavioralView'),       opts)
const BacktestView       = dynamic(() => import('@/components/learnings/BacktestView'),          opts)
const SourcesView        = dynamic(() => import('@/components/learnings/SourcesView'),           opts)

// ── Standalone ────────────────────────────────────────────────────────────────
const BriefingView       = dynamic(() => import('@/components/briefing/BriefingView'),           opts)
const SettingsView       = dynamic(() => import('@/components/settings/SettingsView'),           opts)

export default function TabContent() {
  const activeGroup  = useDashboardStore((s) => s.activeGroup)
  const activeSubTab = useDashboardStore((s) => s.activeSubTab)

  // ── Portfolio ─────────────────────────────────────────────
  if (activeGroup === 'portfolio') {
    if (activeSubTab === 'action')    return <ActionCenterView />
    if (activeSubTab === 'positions') return <MyPositionsView />
    if (activeSubTab === 'sizing')    return <SizingView />
    if (activeSubTab === 'catalysts') return <CatalystView />
    if (activeSubTab === 'hedge')     return <HedgeView />
    if (activeSubTab === 'options')   return <OptionsView />
  }

  // ── Pipeline ──────────────────────────────────────────────
  if (activeGroup === 'pipeline') {
    if (activeSubTab === 'ideas')        return <TradeIdeasView />
    if (activeSubTab === 'validator')    return <ValidatorView />
    if (activeSubTab === 'insider')      return <InsiderFlowView />
    if (activeSubTab === 'smartmoney')   return <SmartMoneyView />
    if (activeSubTab === 'earnings')     return <EarningsView />
    if (activeSubTab === 'momentum')     return <MomentumView />
    if (activeSubTab === 'correlations') return <CorrelationsView />
    if (activeSubTab === 'predictions')  return <PredictionsView />
  }

  // ── Learnings ─────────────────────────────────────────────
  if (activeGroup === 'learnings') {
    if (activeSubTab === 'signals')    return <SignalsView />
    if (activeSubTab === 'paper')      return <PaperTradesView />
    if (activeSubTab === 'thesis')     return <ThesisView />
    if (activeSubTab === 'behavioral') return <BehavioralView />
    if (activeSubTab === 'backtest')   return <BacktestView />
    if (activeSubTab === 'sources')    return <SourcesView />
  }

  // ── Briefing / Settings ───────────────────────────────────
  if (activeGroup === 'briefing') return <BriefingView />
  if (activeGroup === 'settings') return <SettingsView />

  return null
}
