'use client'

import dynamic from 'next/dynamic'

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-4">
      <div className="h-6 w-48 rounded bg-zinc-800" />
      <div className="h-32 w-full rounded bg-zinc-800/60" />
    </div>
  )
}

const SignalsView  = dynamic(() => import('@/components/signals/SignalsView'),   { loading: () => <Skeleton /> })
const WinRateView  = dynamic(() => import('./WinRateView'),                       { loading: () => <Skeleton /> })
const ClaudeLogView = dynamic(() => import('./ClaudeLogView'),                    { loading: () => <Skeleton /> })

/**
 * LearningsHubView — mirrors the HTML's `tab-learnings` which shows
 * Module hit rate, Attribution, Win-rate and the Claude log all together.
 */
export default function LearningsHubView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>⊙ Learning Engine</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.7 }}>
              Welke signalen werken? Win-rate, gemiddeld rendement per type, decision journal.
            </div>
          </div>
          <span className="pill pill-success">Postgres DB</span>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--success-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--success-text)', lineHeight: 1.6 }}>
            Elk significant signaal wordt automatisch gelogd met huidige prijs. Na 1d/5d/20d wordt de uitkomst
            gemeten. Je markeert handmatig of het signaal &quot;klopte&quot; voor lering over tijd.
          </div>
        </div>
      </div>

      {/* Win Rate */}
      <WinRateView />

      {/* Signals overview */}
      <SignalsView />

      {/* Claude verdict log */}
      <ClaudeLogView />
    </div>
  )
}
