'use client'

import { useState } from 'react'
import { ShieldCheck, AlertTriangle } from 'lucide-react'
import { useDashboardStore } from '@/lib/store'

type Action  = 'BUY' | 'SELL' | 'TRIM'
type Verdict = 'PROCEED' | 'WAIT' | 'ABORT'

interface ValidationResult {
  verdict:    Verdict
  reasoning:  string
  rrScore:    number
  conviction: number
}

const verdictStyles: Record<Verdict, { border: string; bg: string; text: string; badge: string }> = {
  PROCEED: { border: 'border-emerald-800', bg: 'bg-emerald-900/20', text: 'text-emerald-400', badge: 'bg-emerald-900/40 text-emerald-300' },
  WAIT:    { border: 'border-amber-800',   bg: 'bg-amber-900/20',   text: 'text-amber-400',   badge: 'bg-amber-900/40 text-amber-300'   },
  ABORT:   { border: 'border-red-800',     bg: 'bg-red-900/20',     text: 'text-red-400',     badge: 'bg-red-900/40 text-red-300'       },
}

export default function ValidatorView() {
  const [ticker,  setTicker]  = useState('')
  const [action,  setAction]  = useState<Action>('BUY')
  const [thesis,  setThesis]  = useState('')
  const [result,  setResult]  = useState<ValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const railwayUrl = useDashboardStore((s) => s.railwayUrl)

  async function validate(e: React.FormEvent) {
    e.preventDefault()
    if (!ticker.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/railway/trade-validator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.trim().toUpperCase(), action, thesis }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `Server error ${res.status}`)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed.')
    } finally {
      setLoading(false)
    }
  }

  const styles = result ? verdictStyles[result.verdict] : null

  return (
    <div className="max-w-2xl space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Trade Validator</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Validate a trade before executing</p>
      </div>

      {/* Backend not configured */}
      {!railwayUrl && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-800/50 bg-amber-900/20 p-4 text-sm text-amber-400">
          <AlertTriangle size={15} className="shrink-0" />
          Backend not configured — add your Railway URL in Settings.
        </div>
      )}

      {/* Form */}
      <form onSubmit={validate} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Ticker</label>
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="AAPL"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-indigo-600 focus:outline-none transition"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as Action)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-indigo-600 focus:outline-none transition"
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
              <option value="TRIM">TRIM</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-400 mb-1.5">
            Thesis <span className="text-zinc-600">(optional)</span>
          </label>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            placeholder="Describe your rationale for this trade…"
            rows={3}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-indigo-600 focus:outline-none resize-none transition"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !ticker.trim()}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 transition"
        >
          <ShieldCheck size={13} />
          {loading ? 'Validating…' : 'Validate Trade'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 animate-pulse space-y-3">
          <div className="h-7 w-32 rounded bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-zinc-800/60" />
            <div className="h-3 w-5/6 rounded bg-zinc-800/60" />
            <div className="h-3 w-3/4 rounded bg-zinc-800/60" />
          </div>
          <div className="flex gap-4 pt-2">
            <div className="h-10 w-24 rounded-lg bg-zinc-800" />
            <div className="h-10 w-24 rounded-lg bg-zinc-800" />
          </div>
        </div>
      )}

      {/* Result */}
      {result && styles && (
        <div className={`rounded-xl border ${styles.border} ${styles.bg} p-5 space-y-4`}>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${styles.badge}`}>
              {result.verdict}
            </span>
            <span className={`text-lg font-bold ${styles.text}`}>
              {result.verdict === 'PROCEED' ? 'Go ahead.' : result.verdict === 'WAIT' ? 'Hold off for now.' : 'Do not proceed.'}
            </span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">{result.reasoning}</p>
          <div className="flex gap-6 pt-2 border-t border-zinc-800">
            <div>
              <p className="text-xs text-zinc-500">Risk/Reward Score</p>
              <p className={`text-2xl font-bold mt-0.5 ${styles.text}`}>{result.rrScore?.toFixed(1) ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Conviction</p>
              <p className={`text-2xl font-bold mt-0.5 ${styles.text}`}>{result.conviction ?? '—'}<span className="text-sm text-zinc-500">/10</span></p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
