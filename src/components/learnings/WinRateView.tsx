'use client'

import { useEffect, useState } from 'react'

interface ModuleStats {
  module: string
  total: number
  correct30d: number
  accuracy: number
}

function accuracyColor(accuracy: number): string {
  if (accuracy >= 60) return 'var(--success-text)'
  if (accuracy >= 45) return 'var(--warning-text)'
  return 'var(--danger-text)'
}

export default function WinRateView() {
  const [data,    setData]    = useState<ModuleStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/win-rate')
      .then(async (r) => {
        if (!r.ok) {
          setError('Win rate data not yet available')
          return
        }
        const j = await r.json()
        setData(j.data ?? [])
      })
      .catch(() => setError('Could not load win rate data'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--success-text)' }}>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--success-text)' }}>🏆 Signal Win Rate</h1>
        <div className="text-xs mt-1" style={{ color: 'var(--success-text)', opacity: 0.85 }}>Accuracy of verdicts evaluated at 30-day mark</div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm py-8 justify-center" style={{ color: 'var(--text-secondary)' }}>
          <span className="h-4 w-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          Loading…
        </div>
      )}

      {!loading && (error || data.length === 0) && (
        <div className="surface px-5 py-8 text-center space-y-2">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            {error ?? 'No win rate data yet'}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Signal win rate data will appear here as verdicts are evaluated.
            Use <strong style={{ color: 'var(--text-secondary)' }}>Evaluate Outcomes</strong> in Claude Log to update.
          </p>
          {/* Placeholder table structure */}
          <div className="mt-6 overflow-x-auto surface" style={{ border: '1px dashed var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['Module', 'Total', 'Correct 30d', 'Accuracy %'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {['Technical', 'Polymarket', 'Sentiment'].map((mod) => (
                  <tr key={mod} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>{mod}</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--text-tertiary)' }}>—</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--text-tertiary)' }}>—</td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--text-tertiary)' }}>—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                {['Module', 'Total', 'Correct 30d', 'Accuracy %'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.module} style={{ borderBottom: '0.5px solid var(--border)' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{row.module}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{row.total}</td>
                  <td className="px-4 py-3 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{row.correct30d}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold" style={{ color: accuracyColor(row.accuracy) }}>
                    {row.accuracy.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
