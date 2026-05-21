'use client'

import { useDashboardStore } from '@/lib/store'

interface Props { ticker: string; className?: string }

export default function TickerChip({ ticker, className }: Props) {
  const setActiveTicker   = useDashboardStore((s) => s.setActiveTicker)
  const setTickerModalOpen = useDashboardStore((s) => s.setTickerModalOpen)

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setActiveTicker(ticker)
        setTickerModalOpen(true)
      }}
      className={`font-mono font-semibold hover:underline transition ${className ?? ''}`}
      style={{ color: 'var(--primary)' }}
    >
      {ticker}
    </button>
  )
}
