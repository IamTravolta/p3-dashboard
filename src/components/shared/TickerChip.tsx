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
      className={`font-mono font-semibold text-indigo-400 hover:text-indigo-300 hover:underline transition ${className ?? ''}`}
    >
      {ticker}
    </button>
  )
}
