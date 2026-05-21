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

const CorrelationsView = dynamic(() => import('@/components/research/CorrelationsView'), { loading: () => <Skeleton /> })
const PredictionsView  = dynamic(() => import('@/components/research/PredictionsView'),  { loading: () => <Skeleton /> })
const OptionsView      = dynamic(() => import('@/components/research/OptionsView'),      { loading: () => <Skeleton /> })

type View = 'correlations' | 'predictions' | 'options'

export default function ResearchView() {
  const [view, setView] = useState<View>('correlations')

  return (
    <div className="space-y-4">
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h1 className="text-xl font-semibold">🌐 Research</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Niet-ticker, wel context. Drie tools die input leveren aan macro-regime en theme-exposure modules — allemaal actief in de signal store.
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {([
            { id: 'correlations' as View, label: 'Correlatie matrix' },
            { id: 'predictions'  as View, label: 'Prediction Markets' },
            { id: 'options'      as View, label: 'Opties' },
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

      {view === 'correlations' && <CorrelationsView />}
      {view === 'predictions'  && <PredictionsView />}
      {view === 'options'      && <OptionsView />}
    </div>
  )
}
