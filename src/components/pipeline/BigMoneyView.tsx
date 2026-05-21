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

const InsiderFlowView = dynamic(() => import('@/components/research/InsiderFlowView'), { loading: () => <Skeleton /> })
const SmartMoneyView  = dynamic(() => import('@/components/research/SmartMoneyView'),  { loading: () => <Skeleton /> })

type View = 'insider' | 'smartmoney'

export default function BigMoneyView() {
  const [view, setView] = useState<View>('insider')

  return (
    <div className="space-y-4">
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h1 className="text-xl font-semibold">💰 Groot Geld</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
          Beide signalen actief in de signal store en wegen mee in elk verdict. Toggle welke view je nu wilt zien.
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {([
            { id: 'insider'    as View, label: 'Insider Form 4 (executives)' },
            { id: 'smartmoney' as View, label: 'Smart Money 13F (hedge funds)' },
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

      {view === 'insider'    && <InsiderFlowView />}
      {view === 'smartmoney' && <SmartMoneyView />}
    </div>
  )
}
