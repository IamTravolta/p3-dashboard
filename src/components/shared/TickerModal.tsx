'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'

function VerdictBadge({ verdict }: { verdict: string }) {
  const colors: Record<string, string> = {
    BUY:  'bg-emerald-900/80 text-emerald-300 border-emerald-700',
    SELL: 'bg-red-900/80 text-red-300 border-red-700',
    HOLD: 'bg-zinc-800 text-zinc-300 border-zinc-700',
  }
  const cls = colors[verdict] ?? colors.HOLD
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {verdict}
    </span>
  )
}

export default function TickerModal() {
  const activeTicker      = useDashboardStore((s) => s.activeTicker)
  const tickerModalOpen   = useDashboardStore((s) => s.tickerModalOpen)
  const setTickerModalOpen = useDashboardStore((s) => s.setTickerModalOpen)
  const signalCache       = useDashboardStore((s) => s.signalCache)

  const cache = activeTicker ? signalCache[activeTicker] : undefined
  const verdict = cache?.verdict

  // Close on Escape
  useEffect(() => {
    if (!tickerModalOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setTickerModalOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tickerModalOpen, setTickerModalOpen])

  if (!tickerModalOpen || !activeTicker) return null

  const tvSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${encodeURIComponent(activeTicker)}&interval=D&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=1A1A2E&studies=[]&theme=dark&style=1&timezone=exchange&withdateranges=1&hidevolume=0&width=440&height=300`

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={() => setTickerModalOpen(false)}
      />

      {/* Sliding panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col border-l border-zinc-800 bg-zinc-900 shadow-2xl"
        style={{ animation: 'slideInRight 0.2s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <span className="font-mono text-2xl font-bold text-white">{activeTicker}</span>
          <button
            onClick={() => setTickerModalOpen(false)}
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-400 hover:text-white transition"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto space-y-5 p-5">
          {/* TradingView chart */}
          <div className="overflow-hidden rounded-xl border border-zinc-800">
            <iframe
              src={tvSrc}
              title={`${activeTicker} chart`}
              width="100%"
              height={300}
              frameBorder="0"
              allowTransparency
              scrolling="no"
              className="block"
            />
          </div>

          {/* Signal section */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Latest Signal</h3>
            {verdict ? (
              <>
                <div className="flex items-center gap-3">
                  <VerdictBadge verdict={verdict.finalVerdict} />
                  <span className="text-sm text-zinc-400">
                    Confidence{' '}
                    <span className="font-semibold text-white">
                      {(verdict.confidence * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
                {verdict.reasoning && (
                  <p className="text-sm text-zinc-400 leading-relaxed">{verdict.reasoning}</p>
                )}
                {cache?.fetchedAt && (
                  <p className="text-[11px] text-zinc-600">
                    Cached {new Date(cache.fetchedAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                No analysis yet — run analysis from Watchlist or Portfolio
              </p>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
