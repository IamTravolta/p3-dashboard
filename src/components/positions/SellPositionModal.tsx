'use client'

import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { Position, SoldPosition } from '@/lib/types/database'

interface SellPositionModalProps {
  open:     boolean
  onClose:  () => void
  position: Position
}

const inputStyle: React.CSSProperties = {
  border: '0.5px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-primary)',
}
const inputClass = 'w-full rounded-lg px-3 py-2 text-sm outline-none transition placeholder-zinc-500'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function SellPositionModal({ open, onClose, position }: SellPositionModalProps) {
  const addSoldPosition = useDashboardStore((s) => s.addSoldPosition)
  const removePosition  = useDashboardStore((s) => s.removePosition)

  const [sellPrice, setSellPrice] = useState('')
  const [sellDate,  setSellDate]  = useState(today())
  const [notes,     setNotes]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const parsedPrice = parseFloat(sellPrice)
    if (!parsedPrice || parsedPrice <= 0) {
      setError('Please enter a valid sell price.')
      setLoading(false)
      return
    }

    try {
      // DELETE the position from the DB (sold positions live in their own store slice)
      const resp = await fetch(`/api/positions/${position.id}`, {
        method: 'DELETE',
      })

      const j = resp.headers.get('content-type')?.includes('json') ? await resp.json() : {}
      if (!resp.ok) throw new Error(j.error ?? 'Failed to delete position')

      // Build SoldPosition for store
      const sold: SoldPosition = {
        ticker:         position.ticker,
        soldDate:       sellDate,
        soldPrice:      parsedPrice,
        avgBuyPrice:    position.avgBuyPrice,
        reasonCategory: 'manual',
        reasonText:     notes || '',
        coolOffUntil:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        evaluations:    [],
      }

      addSoldPosition(sold)
      removePosition(position.id)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const pnl = sellPrice
    ? (parseFloat(sellPrice) - position.avgBuyPrice) * position.shares
    : null
  const pnlPct = sellPrice && position.avgBuyPrice > 0
    ? ((parseFloat(sellPrice) - position.avgBuyPrice) / position.avgBuyPrice) * 100
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ border: '0.5px solid var(--border)', background: 'var(--surface)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '0.5px solid var(--border)' }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              Sell Position
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {position.ticker} · {position.shares} shares · avg {position.currency} {position.avgBuyPrice.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 transition"
            style={{ color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Sell price */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Sell price *
            </label>
            <input
              required
              type="number"
              step="any"
              min="0"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="0.00"
              className={inputClass}
              style={inputStyle}
            />
            {pnl !== null && pnlPct !== null && !isNaN(pnl) && (
              <p
                className="text-xs font-mono mt-1"
                style={{ color: pnl >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}
              >
                Realised P&amp;L: {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                {' '}({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
              </p>
            )}
          </div>

          {/* Sell date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Sell date
            </label>
            <input
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              className={inputClass}
              style={inputStyle}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Notes (optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for sale, exit thesis, lessons learnt…"
              className={`${inputClass} resize-none`}
              style={inputStyle}
            />
          </div>

          {error && (
            <p
              className="rounded-lg px-3 py-2 text-sm"
              style={{ background: 'var(--danger-bg)', border: '0.5px solid var(--danger-text)', color: 'var(--danger-text)' }}
            >
              {error}
            </p>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm transition"
              style={{ color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50"
              style={{ background: 'var(--danger-text)', color: '#fff' }}
            >
              {loading ? 'Recording…' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
