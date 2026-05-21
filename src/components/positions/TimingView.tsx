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

const CatalystView      = dynamic(() => import('./CatalystView'),      { loading: () => <Skeleton /> })
const PreAfterMarketView = dynamic(() => import('./PreAfterMarketView'), { loading: () => <Skeleton /> })

type View = 'catalysts' | 'premarket'

export default function TimingView() {
  const [view, setView] = useState<View>('catalysts')

  return (
    <div className="space-y-4">
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h1 className="text-xl font-semibold">📅 Timing</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Event-gedreven. Aankomende catalysts + extended-hours bewegingen. Beide timing-tools voeden de Alert Hierarchy.
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {([
            { id: 'catalysts' as View, label: 'Catalyst Calendar' },
            { id: 'premarket' as View, label: 'Pre/After-Market' },
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

      {view === 'catalysts' && <CatalystView />}
      {view === 'premarket' && <PreAfterMarketView />}
    </div>
  )
}
