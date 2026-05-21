'use client'

import { useEffect, useState } from 'react'

interface ModuleStats {
  module: string
  total: number
  correct30d: number
  accuracy: number
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
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-white">Signal Win Rate</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          Accuracy of verdicts evaluated at 30-day mark
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-zinc-500 py-8 justify-center">
          <span className="h-4 w-4 rounded-full border-2 border-zinc-600 border-t-indigo-400 animate-spin" />
          Loading…
        </div>
      )}

      {!loading && (error || data.length === 0) && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-5 py-8 text-center space-y-2">
          <p className="text-sm text-zinc-400 font-medium">
            {error ?? 'No win rate data yet'}
          </p>
          <p className="text-xs text-zinc-600">
            Signal win rate data will appear here as verdicts are evaluated.
            Use <strong className="text-zinc-400">Evaluate Outcomes</strong> in Claude Log to update.
          </p>
          {/* Placeholder table structure */}
          <div className="mt-6 overflow-x-auto rounded-xl border border-dashed border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600">Module</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">Total</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">Correct 30d</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600">Accuracy %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {['Technical', 'Polymarket', 'Sentiment'].map((mod) => (
                  <tr key={mod}>
                    <td className="px-4 py-3 text-zinc-600">{mod}</td>
                    <td className="px-4 py-3 text-right text-zinc-700">—</td>
                    <td className="px-4 py-3 text-right text-zinc-700">—</td>
                    <td className="px-4 py-3 text-right text-zinc-700">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">Module</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Correct 30d</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500">Accuracy %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {data.map((row) => (
                <tr key={row.module} className="hover:bg-zinc-800/20 transition">
                  <td className="px-4 py-3 text-zinc-300 font-medium">{row.module}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-400">{row.total}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-400">{row.correct30d}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    <span className={row.accuracy >= 60 ? 'text-emerald-400' : row.accuracy >= 45 ? 'text-amber-400' : 'text-red-400'}>
                      {row.accuracy.toFixed(1)}%
                    </span>
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
