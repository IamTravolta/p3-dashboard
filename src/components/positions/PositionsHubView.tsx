'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3 pt-4">
      <div className="h-6 w-48 rounded bg-zinc-800" />
      <div className="h-32 w-full rounded bg-zinc-800/60" />
    </div>
  )
}

const MyPositionsView   = dynamic(() => import('./MyPositionsView'),   { loading: () => <Skeleton /> })
const SizingView        = dynamic(() => import('./SizingView'),         { loading: () => <Skeleton /> })

type View = 'verdict' | 'table' | 'sell'

export default function PositionsHubView() {
  const [view, setView] = useState<View>('verdict')

  const tabs: { id: View; label: string }[] = [
    { id: 'verdict', label: '📋 Verdict' },
    { id: 'table',   label: '◇ Portfolio tabel' },
    { id: 'sell',    label: '↓ Watch to Sell' },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h1 className="text-xl font-semibold">📋 Posities</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Alle views op je portfolio in één tab. Verdict + tabel + Watch to Sell – dezelfde data, andere weergave.
        </div>
        {/* Toggle buttons */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className="btn"
              style={view === t.id ? {
                background: 'var(--primary)',
                color: 'white',
                borderColor: 'var(--primary)',
              } : {}}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === 'verdict' && <MyPositionsView />}
      {view === 'table'   && <SizingView />}
      {view === 'sell'    && <WatchToSellPane />}
    </div>
  )
}

// Lazy-load Watch to Sell inline
const WatchToSellView = dynamic(() => import('./WatchToSellView'), { loading: () => <Skeleton /> })
function WatchToSellPane() { return <WatchToSellView /> }
