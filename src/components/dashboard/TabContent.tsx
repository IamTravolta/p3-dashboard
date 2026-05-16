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

// next/dynamic requires the options argument to be an inline object literal (not a variable)
// ── Portfolio group ───────────────────────────────────────────────────────────
const ActionCenterView   = dynamic(() => import('@/components/actionCenter/ActionCenterView'),   { loading: () => <Skeleton /> })
const MyPositionsView    = dynamic(() => import('@/components/positions/MyPositionsView'),       { loading: () => <Skeleton /> })
const SizingView         = dynamic(() => import('@/components/positions/SizingView'),            { loading: () => <Skeleton /> })
const CatalystView       = dynamic(() => import('@/components/positions/CatalystView'),          { loading: () => <Skeleton /> })
const HedgeView          = dynamic(() => import('@/components/positions/HedgeView'),             { loading: () => <Skeleton /> })
const OptionsView        = dynamic(() => import('@/components/research/OptionsView'),            { loading: () => <Skeleton /> })

// ── Pipeline group ────────────────────────────────────────────────────────────
const TradeIdeasView     = dynamic(() => import('@/components/research/TradeIdeasView'),         { loading: () => <Skeleton /> })
const ValidatorView      = dynamic(() => import('@/components/research/ValidatorView'),          { loading: () => <Skeleton /> })
const InsiderFlowView    = dynamic(() => import('@/components/research/InsiderFlowView'),        { loading: () => <Skeleton /> })
const SmartMoneyView     = dynamic(() => import('@/components/research/SmartMoneyView'),         { loading: () => <Skeleton /> })
const EarningsView       = dynamic(() => import('@/components/research/EarningsView'),           { loading: () => <Skeleton /> })
const MomentumView       = dynamic(() => import('@/components/research/MomentumView'),           { loading: () => <Skeleton /> })
const CorrelationsView   = dynamic(() => import('@/components/research/CorrelationsView'),       { loading: () => <Skeleton /> })
const PredictionsView    = dynamic(() => import('@/components/research/PredictionsView'),        { loading: () => <Skeleton /> })

// ── Learnings group ───────────────────────────────────────────────────────────
const SignalsView        = dynamic(() => import('@/components/signals/SignalsView'),             { loading: () => <Skeleton /> })
const PaperTradesView    = dynamic(() => import('@/components/paperTrades/PaperTradesView'),     { loading: () => <Skeleton /> })
const ThesisView         = dynamic(() => import('@/components/thesis/ThesisView'),               { loading: () => <Skeleton /> })
const BehavioralView     = dynamic(() => import('@/components/behavioral/BehavioralView'),       { loading: () => <Skeleton /> })
const BacktestView       = dynamic(() => import('@/components/learnings/BacktestView'),          { loading: () => <Skeleton /> })
const SourcesView        = dynamic(() => import('@/components/learnings/SourcesView'),           { loading: () => <Skeleton /> })

// ── Standalone ────────────────────────────────────────────────────────────────
const BriefingView       = dynamic(() => import('@/components/briefing/BriefingView'),           { loading: () => <Skeleton /> })
const SettingsView       = dynamic(() => import('@/components/settings/SettingsView'),           { loading: () => <Skeleton /> })

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
