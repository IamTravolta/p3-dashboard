'use client'

import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, Plus, X, Check } from 'lucide-react'

interface PaperTrade {
  id:          string
  ticker:      string
  name:        string
  exchange:    string
  sector:      string
  direction:   'LONG' | 'SHORT'
  entry_price: number
  exit_price:  number | null
  quantity:    number
  status:      'OPEN' | 'CLOSED'
  reason:      string | null
  entry_date:  string
  exit_date:   string | null
}

interface CloseModalState {
  id:         string
  ticker:     string
  direction:  'LONG' | 'SHORT'
  entryPrice: number
}

export default function PaperTradesView() {
  const [trades,       setTrades]       = useState<PaperTrade[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showAdd,      setShowAdd]      = useState(false)
  const [closeModal,   setCloseModal]   = useState<CloseModalState | null>(null)
  const [tab,          setTab]          = useState<'OPEN' | 'CLOSED'>('OPEN')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/paper-trades')
      const j = await r.json()
      setTrades(j.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const open   = trades.filter((t) => t.status === 'OPEN')
  const closed = trades.filter((t) => t.status === 'CLOSED')
  const shown  = tab === 'OPEN' ? open : closed

  async function deleteTrade(id: string) {
    if (!confirm('Delete this paper trade?')) return
    await fetch(`/api/paper-trades/${id}`, { method: 'DELETE' })
    load()
  }

  function pnl(t: PaperTrade, currentPrice?: number): number {
    const exit  = currentPrice ?? t.exit_price ?? t.entry_price
    const diff  = (exit - t.entry_price) * t.quantity
    return t.direction === 'LONG' ? diff : -diff
  }

  function pnlPct(t: PaperTrade, currentPrice?: number): number {
    const exit = currentPrice ?? t.exit_price ?? t.entry_price
    const pct  = (exit - t.entry_price) / t.entry_price * 100
    return t.direction === 'LONG' ? pct : -pct
  }

  const totalRealised = closed.reduce((sum, t) => sum + pnl(t), 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Paper Trades</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Simulated trades to test ideas before committing capital</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition"
        >
          <Plus size={14} /> New trade
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open trades"   value={open.length.toString()} />
        <StatCard label="Closed trades" value={closed.length.toString()} />
        <StatCard
          label="Total realised P&L"
          value={`€${totalRealised.toFixed(0)}`}
          color={totalRealised >= 0 ? 'text-emerald-400' : 'text-red-400'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-zinc-800/60 p-1 w-fit">
        {(['OPEN', 'CLOSED'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition ${tab === t ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            {t} ({t === 'OPEN' ? open.length : closed.length})
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-zinc-500 text-sm">Loading…</div>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-500 text-sm">
          No {tab.toLowerCase()} paper trades yet.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {['Ticker', 'Direction', 'Entry', 'Exit', 'Qty', 'P&L', 'Date', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const p    = pnl(t)
                const pp   = pnlPct(t)
                const pos  = p >= 0
                return (
                  <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">{t.ticker}</div>
                      <div className="text-xs text-zinc-500">{t.sector}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${t.direction === 'LONG' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                        {t.direction === 'LONG' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-white">€{t.entry_price.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono text-zinc-400">{t.exit_price ? `€${t.exit_price.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3 text-zinc-400">{t.quantity}</td>
                    <td className="px-4 py-3">
                      {t.exit_price || t.status === 'CLOSED' ? (
                        <span className={`font-mono font-semibold ${pos ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pos ? '+' : ''}€{p.toFixed(0)} ({pos ? '+' : ''}{pp.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs">Open</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{new Date(t.entry_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {t.status === 'OPEN' && (
                          <button
                            onClick={() => setCloseModal({ id: t.id, ticker: t.ticker, direction: t.direction, entryPrice: t.entry_price })}
                            className="rounded-md p-1 text-emerald-500 hover:bg-emerald-900/20 transition"
                            title="Close trade"
                          >
                            <Check size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteTrade(t.id)}
                          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-700 hover:text-red-400 transition"
                          title="Delete"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAdd    && <AddTradeModal onClose={() => { setShowAdd(false); load() }} />}
      {closeModal && <CloseTradeModal {...closeModal} onClose={() => { setCloseModal(null); load() }} />}
    </div>
  )
}

/* ── Stat card ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}

/* ── Add trade modal ────────────────────────────────────────────────────────── */
const INPUT = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

function AddTradeModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    ticker: '', name: '', exchange: 'NYSE', sector: 'Technology',
    direction: 'LONG', entry_price: '', quantity: '', reason: '',
  })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const r = await fetch('/api/paper-trades', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ticker: form.ticker.toUpperCase() }),
    })
    const j = await r.json()
    if (j.error) { setError(j.error); setLoading(false); return }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="font-semibold text-white">New paper trade</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-zinc-400">Ticker *</label><input required value={form.ticker} onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" className={INPUT} /></div>
            <div><label className="text-xs text-zinc-400">Name</label><input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Apple Inc." className={INPUT} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Direction</label>
              <select value={form.direction} onChange={(e) => setForm(f => ({ ...f, direction: e.target.value }))} className={INPUT}>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400">Exchange</label>
              <select value={form.exchange} onChange={(e) => setForm(f => ({ ...f, exchange: e.target.value }))} className={INPUT}>
                {['NYSE','NASDAQ','LSE','XETRA','AMS','EPA'].map(ex => <option key={ex}>{ex}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-zinc-400">Entry price (€) *</label><input required type="number" step="any" value={form.entry_price} onChange={(e) => setForm(f => ({ ...f, entry_price: e.target.value }))} placeholder="150.00" className={INPUT} /></div>
            <div><label className="text-xs text-zinc-400">Quantity *</label><input required type="number" min="1" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="100" className={INPUT} /></div>
          </div>
          <div><label className="text-xs text-zinc-400">Reason / thesis</label><textarea rows={2} value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why this trade?" className={`${INPUT} resize-none`} /></div>
          {error && <p className="text-sm text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Saving…' : 'Open trade'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Close trade modal ─────────────────────────────────────────────────────── */
function CloseTradeModal({ id, ticker, direction, entryPrice, onClose }: CloseModalState & { onClose: () => void }) {
  const [exitPrice, setExitPrice] = useState('')
  const [loading,   setLoading]   = useState(false)

  const ep    = parseFloat(exitPrice)
  const diff  = ep ? ((ep - entryPrice) / entryPrice * 100 * (direction === 'LONG' ? 1 : -1)).toFixed(2) : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch(`/api/paper-trades/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CLOSED', exit_price: parseFloat(exitPrice) }),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl p-6 space-y-4">
        <h3 className="font-semibold text-white">Close {ticker}</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400">Exit price (€) *</label>
            <input required type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder={entryPrice.toString()} className={INPUT} />
          </div>
          {diff !== null && (
            <p className={`text-sm font-semibold ${parseFloat(diff) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              Estimated return: {parseFloat(diff) >= 0 ? '+' : ''}{diff}%
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-emerald-600 text-sm text-white hover:bg-emerald-500 disabled:opacity-50">{loading ? 'Closing…' : 'Close trade'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
