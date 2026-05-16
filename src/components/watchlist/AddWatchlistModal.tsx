'use client'

import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { Database, FactorScores, WatchlistItem } from '@/lib/types/database'

type WatchlistInsert = Omit<Database['public']['Tables']['watchlist']['Insert'], 'user_id'>

interface AddWatchlistModalProps {
  open:        boolean
  onClose:     () => void
  editItem?:   { id: string; data: WatchlistInsert & { factor_scores: FactorScores } }
}

const EXCHANGES = ['NYSE', 'NASDAQ', 'AMEX', 'LSE', 'AMS', 'EURONEXT', 'XETRA', 'EPA', 'TSX', 'ASX']
const SECTORS   = [
  'Technology', 'Financials', 'Healthcare', 'Consumer Discretionary',
  'Consumer Staples', 'Energy', 'Industrials', 'Materials',
  'Real Estate', 'Utilities', 'Communication Services', 'Unknown',
]
const FACTOR_LABELS = { q: 'Quality', g: 'Growth', v: 'Valuation', m: 'Momentum', s: 'Sentiment' }
const DEFAULT_FS: FactorScores = { q: 0, g: 0, v: 0, m: 0, s: 0 }

export default function AddWatchlistModal({ open, onClose, editItem }: AddWatchlistModalProps) {
  const upsertWatchlistItem = useDashboardStore((s) => s.upsertWatchlistItem)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const [form, setForm] = useState({
    ticker:        '',
    name:          '',
    exchange:      'NYSE',
    sector:        'Technology',
    sub_industry:  '',
    current_price: '',
    conviction:    3,
    reason:        '',
    price_trigger: '',
    score_trigger: '',
    expiry_date:   '',
    factor_scores: DEFAULT_FS,
  })

  useEffect(() => {
    if (editItem) {
      const d  = editItem.data
      const fs = (d.factor_scores ?? DEFAULT_FS) as FactorScores
      setForm({
        ticker:        d.ticker,
        name:          d.name,
        exchange:      d.exchange,
        sector:        d.sector,
        sub_industry:  d.sub_industry  ?? '',
        current_price: String(d.current_price ?? ''),
        conviction:    d.conviction    ?? 3,
        reason:        d.reason        ?? '',
        price_trigger: d.price_trigger != null ? String(d.price_trigger) : '',
        score_trigger: d.score_trigger != null ? String(d.score_trigger) : '',
        expiry_date:   d.expiry_date   ?? '',
        factor_scores: { q: fs.q, g: fs.g, v: fs.v, m: fs.m, s: fs.s },
      })
    } else {
      resetForm()
    }
  }, [editItem, open])

  function resetForm() {
    setForm({
      ticker: '', name: '', exchange: 'NYSE', sector: 'Technology',
      sub_industry: '', current_price: '', conviction: 3, reason: '',
      price_trigger: '', score_trigger: '', expiry_date: '',
      factor_scores: DEFAULT_FS,
    })
  }

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setFactor(key: keyof FactorScores, value: number) {
    setForm((f) => ({ ...f, factor_scores: { ...f.factor_scores, [key]: value } }))
  }

  const score = (
    form.factor_scores.q * 0.25 +
    form.factor_scores.g * 0.25 +
    form.factor_scores.v * 0.20 +
    form.factor_scores.m * 0.15 +
    form.factor_scores.s * 0.15
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const payload = {
      ticker:        form.ticker.toUpperCase().trim(),
      name:          form.name.trim(),
      exchange:      form.exchange,
      sector:        form.sector,
      sub_industry:  form.sub_industry || null,
      current_price: parseFloat(form.current_price) || 0,
      score:         parseFloat(score.toFixed(2)),
      factor_scores: form.factor_scores,
      reason:        form.reason || null,
      price_trigger: form.price_trigger ? parseFloat(form.price_trigger) : null,
      score_trigger: form.score_trigger ? parseFloat(form.score_trigger) : null,
      conviction:    form.conviction,
      expiry_date:   form.expiry_date   || null,
    }

    try {
      let data: Database['public']['Tables']['watchlist']['Row']

      if (editItem) {
        const resp = await fetch(`/api/watchlist/${editItem.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const json = await resp.json()
        if (json.error || !resp.ok) throw new Error(json.error ?? 'Update failed')
        data = json.data
      } else {
        const resp = await fetch('/api/watchlist', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const json = await resp.json()
        if (json.error || !resp.ok) throw new Error(json.error ?? 'Create failed')
        data = json.data
      }

      upsertWatchlistItem({
        id:           data.id,
        ticker:       data.ticker,
        name:         data.name,
        exchange:     data.exchange,
        sector:       data.sector,
        subIndustry:  data.sub_industry  ?? '',
        currentPrice: data.current_price,
        score:        data.score,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        factorScores: data.factor_scores as any as FactorScores,
        reason:       data.reason        ?? '',
        priceTrigger: data.price_trigger ?? null,
        scoreTrigger: data.score_trigger ?? null,
        conviction:   data.conviction,
        expiryDate:   data.expiry_date   ?? null,
        addedDate:    data.added_at,
      })

      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <h2 className="text-base font-semibold text-white">
            {editItem ? 'Edit watchlist item' : 'Add to watchlist'}
          </h2>
          <button onClick={onClose} className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white transition">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Ticker + Name */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker *">
              <input required value={form.ticker} onChange={(e) => set('ticker', e.target.value.toUpperCase())} placeholder="NVDA" className={INPUT} />
            </Field>
            <Field label="Company name *">
              <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="NVIDIA Corporation" className={INPUT} />
            </Field>
          </div>

          {/* Exchange + Sector */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exchange">
              <select value={form.exchange} onChange={(e) => set('exchange', e.target.value)} className={INPUT}>
                {EXCHANGES.map((ex) => <option key={ex}>{ex}</option>)}
              </select>
            </Field>
            <Field label="Sector">
              <select value={form.sector} onChange={(e) => set('sector', e.target.value)} className={INPUT}>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Current price */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current price">
              <input type="number" step="any" min="0" value={form.current_price} onChange={(e) => set('current_price', e.target.value)} placeholder="450.00" className={INPUT} />
            </Field>
            <Field label="Expiry date (optional)">
              <input type="date" value={form.expiry_date} onChange={(e) => set('expiry_date', e.target.value)} className={INPUT} />
            </Field>
          </div>

          {/* Triggers */}
          <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-4 space-y-3">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Alert triggers</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price drops to (€)">
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={form.price_trigger}
                  onChange={(e) => set('price_trigger', e.target.value)}
                  placeholder="e.g. 400.00"
                  className={INPUT}
                />
                <p className="text-xs text-zinc-600 mt-1">Alert when live price ≤ this</p>
              </Field>
              <Field label="Score reaches (0–10)">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={form.score_trigger}
                  onChange={(e) => set('score_trigger', e.target.value)}
                  placeholder="e.g. 7.5"
                  className={INPUT}
                />
                <p className="text-xs text-zinc-600 mt-1">Alert when conviction score ≥ this</p>
              </Field>
            </div>
          </div>

          {/* Factor scores */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Factor Scores (0–10)</p>
              <span className="text-xs text-indigo-400 font-mono">Score: {score.toFixed(2)}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(FACTOR_LABELS) as (keyof FactorScores)[]).map((k) => (
                <div key={k} className="space-y-1">
                  <label className="block text-xs text-zinc-500">{FACTOR_LABELS[k]}</label>
                  <input type="number" min="0" max="10" step="0.5" value={form.factor_scores[k]} onChange={(e) => setFactor(k, parseFloat(e.target.value) || 0)} className={INPUT} />
                </div>
              ))}
            </div>
          </div>

          {/* Conviction */}
          <Field label={`Conviction: ${CONVICTION[form.conviction - 1]}`}>
            <input type="range" min="1" max="5" value={form.conviction} onChange={(e) => set('conviction', parseInt(e.target.value))} className="w-full accent-indigo-500" />
            <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
              {CONVICTION.map((l) => <span key={l}>{l}</span>)}
            </div>
          </Field>

          {/* Reason */}
          <Field label="Why watching?">
            <textarea rows={3} value={form.reason} onChange={(e) => set('reason', e.target.value)} placeholder="What would make you pull the trigger on this?" className={`${INPUT} resize-none`} />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition">Cancel</button>
            <button type="submit" disabled={loading} className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition">
              {loading ? 'Saving…' : editItem ? 'Update' : 'Add to watchlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const INPUT = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'
const CONVICTION = ['Very Low', 'Low', 'Medium', 'High', 'Very High']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}
