'use client'

import { useDashboardStore } from '@/lib/store'

/**
 * Placeholder for tabs that aren't built yet.
 * Shows a "coming soon" card for signals, paper trades, thesis, behavior, settings.
 */
export default function TabContent() {
  const activeTab = useDashboardStore((s) => s.activeTab)

  const PLACEHOLDERS: Record<string, { icon: string; label: string; desc: string }> = {
    signals: {
      icon:  '🔬',
      label: 'Signal Engine',
      desc:  'Run multi-module AI analysis (Technical, Polymarket, Sentiment, Macro) on any ticker. Results are saved to Supabase and tracked for accuracy over 30/60/90 days.',
    },
    paper: {
      icon:  '📝',
      label: 'Paper Trades',
      desc:  'Log hypothetical trades with stop-loss and target levels. The system evaluates them at 30, 60, and 90 days to measure your prediction accuracy.',
    },
    thesis: {
      icon:  '📖',
      label: 'Thesis Tracker',
      desc:  'Write and track your investment thesis for each position. Version history lets you see how your thinking evolved over time.',
    },
    behavioral: {
      icon:  '🧠',
      label: 'Behavioral Intelligence',
      desc:  'Tracks whether you follow or override system recommendations. Over time, the AI learns when your overrides were right and adapts its confidence thresholds.',
    },
    settings: {
      icon:  '⚙️',
      label: 'Settings',
      desc:  'Configure factor score weights, portfolio caps, currency, and notification preferences.',
    },
  }

  const placeholder = PLACEHOLDERS[activeTab]
  if (!placeholder) return null

  return (
    <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 py-20 text-center">
      <p className="text-4xl mb-4">{placeholder.icon}</p>
      <h2 className="text-lg font-semibold text-white mb-2">{placeholder.label}</h2>
      <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">{placeholder.desc}</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-zinc-800 px-4 py-1.5 text-xs text-zinc-500">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
        Building next
      </div>
    </div>
  )
}
