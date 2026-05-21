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
    <div className="space-y-5">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--warning-text)' }}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--warning-text)' }}>📝 Paper Trades</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--warning-text)', opacity: 0.85 }}>Simulated trades to test ideas before committing capital</div>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="btn btn-primary flex items-center gap-1.5"
          >
            <Plus size={14} /> New trade
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Open trades"   value={open.length.toString()} />
        <StatCard label="Closed trades" value={closed.length.toString()} />
        <StatCard
          label="Total realised P&L"
          value={`€${totalRealised.toFixed(0)}`}
          color={totalRealised >= 0 ? 'var(--success-text)' : 'var(--danger-text)'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ background: 'var(--surface)' }}>
        {(['OPEN', 'CLOSED'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="rounded-md px-4 py-1.5 text-xs font-medium transition"
            style={tab === t
              ? { background: 'var(--bg)', color: 'var(--text-primary)' }
              : { color: 'var(--text-secondary)' }}
          >
            {t} ({t === 'OPEN' ? open.length : closed.length})
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="py-12 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Loading…</div>
      ) : shown.length === 0 ? (
        <div className="surface p-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          No {tab.toLowerCase()} paper trades yet.
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                {['Ticker', 'Direction', 'Entry', 'Exit', 'Qty', 'P&L', 'Date', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => {
                const p    = pnl(t)
                const pp   = pnlPct(t)
                const pos  = p >= 0
                return (
                  <tr key={t.id} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t.ticker}</div>
                      <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{t.sector}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                        style={t.direction === 'LONG'
                          ? { background: 'var(--success-bg)', color: 'var(--success-text)' }
                          : { background: 'var(--danger-bg)', color: 'var(--danger-text)' }}
                      >
                        {t.direction === 'LONG' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                        {t.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)' }}>€{t.entry_price.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>{t.exit_price ? `€${t.exit_price.toFixed(2)}` : '—'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{t.quantity}</td>
                    <td className="px-4 py-3">
                      {t.exit_price || t.status === 'CLOSED' ? (
                        <span className="font-mono font-semibold" style={{ color: pos ? 'var(--success-text)' : 'var(--danger-text)' }}>
                          {pos ? '+' : ''}€{p.toFixed(0)} ({pos ? '+' : ''}{pp.toFixed(1)}%)
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Open</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(t.entry_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {t.status === 'OPEN' && (
                          <button
                            onClick={() => setCloseModal({ id: t.id, ticker: t.ticker, direction: t.direction, entryPrice: t.entry_price })}
                            className="rounded-md p-1 transition"
                            style={{ color: 'var(--success-text)' }}
                            title="Close trade"
                          >
                            <Check size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => deleteTrade(t.id)}
                          className="rounded-md p-1 transition"
                          style={{ color: 'var(--text-tertiary)' }}
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
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="kpi-card">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color: color ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  )
}

/* ── Shared input style ─────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  border: '0.5px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
}

const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition'

/* ── Add trade modal ────────────────────────────────────────────────────────── */
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '0.5px solid var(--border)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>New paper trade</h3>
          <button onClick={onClose} style={{ color: 'var(--text-tertiary)' }}>✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ticker *</label>
              <input required value={form.ticker} onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} placeholder="AAPL" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Name</label>
              <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Apple Inc." className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Direction</label>
              <select value={form.direction} onChange={(e) => setForm(f => ({ ...f, direction: e.target.value }))} className={inputClass} style={inputStyle}>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Exchange</label>
              <select value={form.exchange} onChange={(e) => setForm(f => ({ ...f, exchange: e.target.value }))} className={inputClass} style={inputStyle}>
                {['NYSE','NASDAQ','LSE','XETRA','AMS','EPA'].map(ex => <option key={ex}>{ex}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Entry price (€) *</label>
              <input required type="number" step="any" value={form.entry_price} onChange={(e) => setForm(f => ({ ...f, entry_price: e.target.value }))} placeholder="150.00" className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Quantity *</label>
              <input required type="number" min="1" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} placeholder="100" className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Reason / thesis</label>
            <textarea rows={2} value={form.reason} onChange={(e) => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Why this trade?" className={`${inputClass} resize-none`} style={inputStyle} />
          </div>
          {error && <p className="text-sm rounded-lg px-3 py-2" style={{ color: 'var(--danger-text)', background: 'var(--danger-bg)' }}>{error}</p>}
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-50">{loading ? 'Saving…' : 'Open trade'}</button>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl p-6 space-y-4" style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}>
        <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Close {ticker}</h3>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>Exit price (€) *</label>
            <input required type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} placeholder={entryPrice.toString()} className={inputClass} style={inputStyle} />
          </div>
          {diff !== null && (
            <p className="text-sm font-semibold" style={{ color: parseFloat(diff) >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
              Estimated return: {parseFloat(diff) >= 0 ? '+' : ''}{diff}%
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Cancel</button>
            <button type="submit" disabled={loading} className="btn btn-primary disabled:opacity-50">{loading ? 'Closing…' : 'Close trade'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
