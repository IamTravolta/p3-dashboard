'use client'

import { useState } from 'react'
import { useDashboardStore } from '@/lib/store'
import type { Position, SoldPosition } from '@/lib/types/database'

interface SellPositionModalProps {
  open:     boolean
  onClose:  () => void
  position: Position
}

const INPUT_CLS = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">Sell Position</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {position.ticker} · {position.shares} shares · avg {position.currency} {position.avgBuyPrice.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Sell price */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">Sell price *</label>
            <input
              required
              type="number"
              step="any"
              min="0"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="0.00"
              className={INPUT_CLS}
            />
            {pnl !== null && pnlPct !== null && !isNaN(pnl) && (
              <p className={`text-xs font-mono mt-1 ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                Realised P&L: {pnl >= 0 ? '+' : ''}{pnl.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                {' '}({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
              </p>
            )}
          </div>

          {/* Sell date */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">Sell date</label>
            <input
              type="date"
              value={sellDate}
              onChange={(e) => setSellDate(e.target.value)}
              className={INPUT_CLS}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-zinc-400">Notes (optional)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for sale, exit thesis, lessons learnt…"
              className={`${INPUT_CLS} resize-none`}
            />
          </div>

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
              className="px-5 py-2 rounded-lg bg-red-700 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50 transition"
            >
              {loading ? 'Recording…' : 'Record Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
