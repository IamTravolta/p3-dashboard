'use client'

import { useEffect } from 'react'
import { useDashboardStore } from '@/lib/store'

function VerdictBadge({ verdict }: { verdict: string }) {
  const styleMap: Record<string, React.CSSProperties> = {
    BUY:  { background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-text)' },
    SELL: { background: 'var(--danger-bg)',  color: 'var(--danger-text)',  border: '1px solid var(--danger-text)'  },
    HOLD: { background: 'var(--surface)',    color: 'var(--text-secondary)', border: '1px solid var(--border)'     },
  }
  const s = styleMap[verdict] ?? styleMap.HOLD
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={s}
    >
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
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        onClick={() => setTickerModalOpen(false)}
      />

      {/* Sliding panel */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[480px] flex-col shadow-2xl"
        style={{
          borderLeft: '0.5px solid var(--border)',
          background: 'var(--surface)',
          animation: 'slideInRight 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: '0.5px solid var(--border)' }}
        >
          <span className="font-mono text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {activeTicker}
          </span>
          <button
            onClick={() => setTickerModalOpen(false)}
            className="rounded-lg p-1.5 transition"
            style={{
              border: '0.5px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-secondary)',
            }}
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
          <div
            className="overflow-hidden rounded-xl"
            style={{ border: '0.5px solid var(--border)' }}
          >
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
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ border: '0.5px solid var(--border)', background: 'var(--bg)' }}
          >
            <h3
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Latest Signal
            </h3>
            {verdict ? (
              <>
                <div className="flex items-center gap-3">
                  <VerdictBadge verdict={verdict.finalVerdict} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Confidence{' '}
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {(verdict.confidence * 100).toFixed(0)}%
                    </span>
                  </span>
                </div>
                {verdict.reasoning && (
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {verdict.reasoning}
                  </p>
                )}
                {cache?.fetchedAt && (
                  <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                    Cached {new Date(cache.fetchedAt).toLocaleString()}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
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
