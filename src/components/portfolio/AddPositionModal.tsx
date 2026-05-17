'use client'

import { useState, useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { Database } from '@/lib/types/database'
import type { FactorScores } from '@/lib/types/database'
import PreTradeChecklist, { type ChecklistAnswers } from '@/components/positions/PreTradeChecklist'

type PositionInsert = Omit<Database['public']['Tables']['positions']['Insert'], 'user_id'>

interface AddPositionModalProps {
  open:    boolean
  onClose: () => void
  // Pass a position to edit an existing one
  editPosition?: {
    id:    string
    data:  PositionInsert & { factor_scores: FactorScores }
  }
}

const EXCHANGES = ['NYSE', 'NASDAQ', 'AMEX', 'LSE', 'AMS', 'EURONEXT', 'XETRA', 'EPA', 'TSX', 'ASX']
const SECTORS   = [
  'Technology', 'Financials', 'Healthcare', 'Consumer Discretionary',
  'Consumer Staples', 'Energy', 'Industrials', 'Materials',
  'Real Estate', 'Utilities', 'Communication Services', 'Unknown',
]

const DEFAULT_FACTORS: FactorScores = { q: 0, g: 0, v: 0, m: 0, s: 0 }
const FACTOR_LABELS: Record<keyof FactorScores, string> = {
  q: 'Quality',
  g: 'Growth',
  v: 'Valuation',
  m: 'Momentum',
  s: 'Sentiment',
}

export default function AddPositionModal({ open, onClose, editPosition }: AddPositionModalProps) {
  const upsertPosition = useDashboardStore((s) => s.upsertPosition)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  // Pre-trade checklist gate — only for new positions
  const [checklistDone, setChecklistDone]   = useState(false)
  const [checklistData, setChecklistData]   = useState<ChecklistAnswers | null>(null)
  const [pendingTicker, setPendingTicker]   = useState('')

  // Reset checklist state when modal opens/closes or when switching between add/edit
  useEffect(() => {
    if (!open) {
      setChecklistDone(false)
      setChecklistData(null)
      setPendingTicker('')
    }
  }, [open, editPosition])

  const [form, setForm] = useState({
    ticker:        '',
    name:          '',
    exchange:      'NYSE',
    sector:        'Technology',
    sub_industry:  '',
    shares:        '',
    avg_buy_price: '',
    current_price: '',
    currency:      'USD',
    conviction:    3,
    thesis:        '',
    notes:         '',
    factor_scores: DEFAULT_FACTORS,
  })

  // Populate form when editing
  useEffect(() => {
    if (editPosition) {
      const d = editPosition.data
      const fs = (d.factor_scores ?? DEFAULT_FACTORS) as FactorScores
      setForm({
        ticker:        d.ticker,
        name:          d.name,
        exchange:      d.exchange,
        sector:        d.sector,
        sub_industry:  d.sub_industry ?? '',
        shares:        String(d.shares),
        avg_buy_price: String(d.avg_buy_price),
        current_price: String(d.current_price),
        currency:      d.currency,
        conviction:    d.conviction ?? 3,
        thesis:        d.thesis ?? '',
        notes:         d.notes  ?? '',
        factor_scores: { q: fs.q, g: fs.g, v: fs.v, m: fs.m, s: fs.s },
      })
    } else {
      setForm({
        ticker: '', name: '', exchange: 'NYSE', sector: 'Technology',
        sub_industry: '', shares: '', avg_buy_price: '', current_price: '',
        currency: 'USD', conviction: 3, thesis: '', notes: '',
        factor_scores: DEFAULT_FACTORS,
      })
    }
  }, [editPosition, open])

  function set(key: string, value: string | number) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function setFactor(key: keyof FactorScores, value: number) {
    setForm((f) => ({
      ...f,
      factor_scores: { ...f.factor_scores, [key]: value },
    }))
  }

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
      shares:        parseFloat(form.shares) || 0,
      avg_buy_price: parseFloat(form.avg_buy_price) || 0,
      current_price: parseFloat(form.current_price) || 0,
      currency:      form.currency,
      factor_scores: form.factor_scores,
      conviction:    form.conviction,
      thesis:        form.thesis || null,
      notes:         form.notes  || null,
    }

    try {
      if (editPosition) {
        // PATCH
        const resp = await fetch(`/api/positions/${editPosition.id}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const { data, error: apiErr } = await resp.json()
        if (apiErr || !resp.ok) throw new Error(apiErr ?? 'Update failed')

        upsertPosition({
          ...data,
          subIndustry:  data.sub_industry ?? '',
          avgBuyPrice:  data.avg_buy_price,
          currentPrice: data.current_price,
          factorScores: data.factor_scores as FactorScores,
          addedDate:    data.added_at,
        })
      } else {
        // POST
        const resp = await fetch('/api/positions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        })
        const { data, error: apiErr } = await resp.json()
        if (apiErr || !resp.ok) throw new Error(apiErr ?? 'Create failed')

        upsertPosition({
          id:           data.id,
          ticker:       data.ticker,
          name:         data.name,
          exchange:     data.exchange,
          sector:       data.sector,
          subIndustry:  data.sub_industry ?? '',
          shares:       data.shares,
          avgBuyPrice:  data.avg_buy_price,
          currentPrice: data.current_price,
          currency:     data.currency,
          factorScores: data.factor_scores as FactorScores,
          conviction:   data.conviction,
          thesis:       data.thesis  ?? '',
          notes:        data.notes   ?? '',
          addedDate:    data.added_at,
        })
      }

      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // Show checklist gate for new positions before form is visible
  if (open && !editPosition && !checklistDone) {
    const ticker = form.ticker.trim()

    if (!ticker) {
      // Step 1: collect ticker before showing checklist
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
            <div>
              <h2 className="text-base font-semibold text-white">Add Position</h2>
              <p className="text-xs text-zinc-500 mt-1">Enter the ticker first — you will complete a pre-trade checklist before the position is added.</p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-zinc-400">Ticker *</label>
              <input
                autoFocus
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter' && form.ticker.trim()) setPendingTicker(form.ticker.trim()) }}
                placeholder="AAPL"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition">Cancel</button>
              <button
                onClick={() => { if (form.ticker.trim()) setPendingTicker(form.ticker.trim()) }}
                disabled={!form.ticker.trim()}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
              >
                Continue to Checklist →
              </button>
            </div>
          </div>
        </div>
      )
    }

    // Step 2: pre-trade checklist
    return (
      <PreTradeChecklist
        ticker={ticker}
        onCancel={onClose}
        onSubmit={(answers) => {
          setChecklistData(answers)
          setChecklistDone(true)
          const combinedThesis = [
            `Thesis: ${answers.thesis}`,
            `Catalyst: ${answers.catalyst}`,
            `Invalidation: ${answers.invalidation}`,
            `Stop loss: ${answers.stopLoss}`,
            `Target: ${answers.target}`,
            `Size rationale: ${answers.sizeRationale}`,
          ].join('\n')
          set('thesis', combinedThesis)
        }}
      />
    )
  }

  if (!open) return null

  const totalScore = (
    form.factor_scores.q * 0.25 +
    form.factor_scores.g * 0.25 +
    form.factor_scores.v * 0.20 +
    form.factor_scores.m * 0.15 +
    form.factor_scores.s * 0.15
  ).toFixed(1)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">
              {editPosition ? 'Edit Position' : 'Add Position'}
            </h2>
            {checklistDone && (
              <span className="rounded-full bg-emerald-900/40 border border-emerald-700/50 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                ✓ Checklist complete
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Ticker + Name */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ticker *">
              <input
                required
                value={form.ticker}
                onChange={(e) => set('ticker', e.target.value.toUpperCase())}
                placeholder="AAPL"
                className={INPUT_CLS}
              />
            </Field>
            <Field label="Company name *">
              <input
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Apple Inc."
                className={INPUT_CLS}
              />
            </Field>
          </div>

          {/* Exchange + Sector */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Exchange">
              <select value={form.exchange} onChange={(e) => set('exchange', e.target.value)} className={INPUT_CLS}>
                {EXCHANGES.map((ex) => <option key={ex}>{ex}</option>)}
              </select>
            </Field>
            <Field label="Sector">
              <select value={form.sector} onChange={(e) => set('sector', e.target.value)} className={INPUT_CLS}>
                {SECTORS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          {/* Shares + Avg Buy + Current Price + Currency */}
          <div className="grid grid-cols-4 gap-3">
            <Field label="Shares">
              <input type="number" step="any" min="0" value={form.shares} onChange={(e) => set('shares', e.target.value)} placeholder="10" className={INPUT_CLS} />
            </Field>
            <Field label="Avg buy price">
              <input type="number" step="any" min="0" value={form.avg_buy_price} onChange={(e) => set('avg_buy_price', e.target.value)} placeholder="150.00" className={INPUT_CLS} />
            </Field>
            <Field label="Current price">
              <input type="number" step="any" min="0" value={form.current_price} onChange={(e) => set('current_price', e.target.value)} placeholder="213.00" className={INPUT_CLS} />
            </Field>
            <Field label="Currency">
              <select value={form.currency} onChange={(e) => set('currency', e.target.value)} className={INPUT_CLS}>
                {['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'HKD'].map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          {/* Factor scores */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Factor Scores (0–10)</p>
              <span className="text-xs text-indigo-400 font-mono">Weighted score: {totalScore}</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {(Object.keys(FACTOR_LABELS) as (keyof FactorScores)[]).map((k) => (
                <div key={k} className="space-y-1">
                  <label className="block text-xs text-zinc-500">{FACTOR_LABELS[k]}</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.5"
                    value={form.factor_scores[k]}
                    onChange={(e) => setFactor(k, parseFloat(e.target.value) || 0)}
                    className={INPUT_CLS}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Conviction */}
          <Field label={`Conviction: ${CONVICTION_LABELS[form.conviction - 1]}`}>
            <input
              type="range"
              min="1"
              max="5"
              value={form.conviction}
              onChange={(e) => set('conviction', parseInt(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-zinc-600 mt-0.5">
              {CONVICTION_LABELS.map((l) => <span key={l}>{l}</span>)}
            </div>
          </Field>

          {/* Thesis */}
          <Field label="Investment thesis">
            <textarea
              rows={3}
              value={form.thesis}
              onChange={(e) => set('thesis', e.target.value)}
              placeholder="Why do you own this position? What's the thesis?"
              className={`${INPUT_CLS} resize-none`}
            />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="Optional notes, catalysts, risks..."
              className={`${INPUT_CLS} resize-none`}
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-red-900/20 border border-red-800 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {loading ? 'Saving…' : editPosition ? 'Update' : 'Add position'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const INPUT_CLS = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

const CONVICTION_LABELS = ['Very Low', 'Low', 'Medium', 'High', 'Very High']

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-zinc-400">{label}</label>
      {children}
    </div>
  )
}
