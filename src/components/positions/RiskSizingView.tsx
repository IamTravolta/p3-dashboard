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

const SizingView = dynamic(() => import('./SizingView'), { loading: () => <Skeleton /> })
const HedgeView  = dynamic(() => import('./HedgeView'),  { loading: () => <Skeleton /> })

type View = 'sizing' | 'hedge'

export default function RiskSizingView() {
  const [view, setView] = useState<View>('sizing')

  return (
    <div className="space-y-4">
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h1 className="text-xl font-semibold">🛡 Risk &amp; Sizing</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Proactief risk-management. Hoeveel kopen (Kelly) + hoe afdekken (hedges). Beide modules actief in signal store.
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {([
            { id: 'sizing' as View, label: 'Sizing (Kelly)' },
            { id: 'hedge'  as View, label: 'Risk-Off Hedges' },
          ] as const).map(t => (
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

      {view === 'sizing' && <SizingView />}
      {view === 'hedge'  && <HedgeView />}
    </div>
  )
}
