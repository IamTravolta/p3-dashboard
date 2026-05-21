'use client'

import { useState, useEffect, useRef } from 'react'
import { useDashboardStore } from '@/lib/store'

// ── TradingView chart widget ──────────────────────────────────────────────────
function TradingViewChart({ ticker }: { ticker: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [tvInterval, setTvInterval] = useState('D')
  const containerId = `tv-chart-${ticker}-unified`

  useEffect(() => {
    if (!ticker || !containerRef.current) return
    const container = containerRef.current
    container.innerHTML = ''

    const tvSymbol = mapToTVSymbol(ticker)

    function createWidget() {
      if (!(window as any).TradingView || !containerRef.current) return
      new (window as any).TradingView.widget({
        symbol: tvSymbol,
        interval: tvInterval,
        container_id: containerId,
        autosize: true,
        timezone: 'Europe/Amsterdam',
        theme: 'dark',
        style: '1',
        locale: 'en',
        toolbar_bg: '#2A2A2F',
        enable_publishing: false,
        hide_top_toolbar: false,
        withdateranges: true,
        save_image: false,
        studies: ['Volume@tv-basicstudies', 'MASimple@tv-basicstudies', 'RSI@tv-basicstudies'],
      })
    }

    if ((window as any).TradingView) {
      createWidget()
    } else {
      const existing = document.getElementById('tv-script')
      if (!existing) {
        const script = document.createElement('script')
        script.id = 'tv-script'
        script.src = 'https://s3.tradingview.com/tv.js'
        script.async = true
        script.onload = createWidget
        document.head.appendChild(script)
      } else {
        // Script loading – retry shortly
        const t = setTimeout(createWidget, 1500)
        return () => clearTimeout(t)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, tvInterval])

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid #D4A547' }}>
      <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
        <div>
          <h3 className="text-base font-semibold">📈 TradingView Chart — {ticker}</h3>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Live candles + volume + RSI. Wissel interval via knoppen.
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {(['5', '60', 'D', 'W'] as const).map(iv => (
            <button
              key={iv}
              onClick={() => setTvInterval(iv)}
              className="rounded px-2 py-1 text-xs"
              style={{
                background: tvInterval === iv ? 'var(--primary)' : 'var(--bg)',
                color: tvInterval === iv ? 'white' : 'var(--text-secondary)',
                border: '0.5px solid var(--border)',
              }}
            >
              {iv === '5' ? '5m' : iv === '60' ? '1h' : iv === 'D' ? '1D' : '1W'}
            </button>
          ))}
        </div>
      </div>
      <div id={containerId} ref={containerRef} style={{ height: 460, width: '100%', background: 'var(--bg)' }} />
      <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
        Powered by TradingView · free widget
      </div>
    </div>
  )
}

function mapToTVSymbol(ticker: string): string {
  if (ticker.endsWith('.AS')) return `EURONEXT:${ticker.replace('.AS', '')}`
  if (ticker.endsWith('.PA')) return `EURONEXT:${ticker.replace('.PA', '')}`
  if (ticker.endsWith('.DE')) return `XETR:${ticker.replace('.DE', '')}`
  if (ticker.endsWith('.L'))  return `LSE:${ticker.replace('.L', '')}`
  return `NASDAQ:${ticker}`
}

// ── Position context card ─────────────────────────────────────────────────────
function PositionCard({ ticker }: { ticker: string }) {
  const positions = useDashboardStore(s => s.positions)
  const prices    = useDashboardStore(s => s.prices)
  const pos = positions.find(p => p.ticker === ticker)
  if (!pos) return null

  const price   = prices[ticker] ?? pos.currentPrice ?? pos.avgBuyPrice
  const value   = pos.shares * price
  const pnl     = (price - pos.avgBuyPrice) * pos.shares
  const pnlPct  = ((price - pos.avgBuyPrice) / pos.avgBuyPrice) * 100
  const isPos   = pnl >= 0

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid var(--info-text)' }}>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--info-text)' }}>◇ Positie context</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Shares</div>
          <div className="text-lg font-semibold mt-0.5">{pos.shares}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Gem. koopprijs</div>
          <div className="text-lg font-semibold mt-0.5">€{pos.avgBuyPrice.toFixed(2)}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Waarde</div>
          <div className="text-lg font-semibold mt-0.5">€{value.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>P&amp;L</div>
          <div className="text-lg font-semibold mt-0.5" style={{ color: isPos ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {isPos ? '+' : ''}{pnlPct.toFixed(1)}%
          </div>
          <div className="text-xs" style={{ color: isPos ? 'var(--success-text)' : 'var(--danger-text)' }}>
            {isPos ? '+' : ''}€{pnl.toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Signal snapshot / Unified Verdict ─────────────────────────────────────────
function SignalSnapshot({ ticker }: { ticker: string }) {
  const signalCache = useDashboardStore(s => s.signalCache)
  const entry = signalCache[ticker]

  if (!entry) {
    return (
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--purple-text)' }}>🎯 Unified Verdict</h3>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Nog geen signaaldata voor {ticker}. Gebruik Action Center → sync om signalen op te halen.
        </p>
      </div>
    )
  }

  const verdict = entry.verdict
  const signals = entry.signals as Record<string, { value?: number; label?: string }> | undefined

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--purple-text)' }}>🎯 Unified Verdict</h3>
        {verdict && (
          <span className="pill pill-purple" style={{ flexShrink: 0 }}>
            {verdict.confidence}% confidence
          </span>
        )}
      </div>

      {verdict && (
        <>
          <div className="rounded p-2.5 mb-3" style={{ background: 'var(--purple-bg)' }}>
            <div className="text-sm font-bold" style={{ color: 'var(--purple-text)' }}>{verdict.finalVerdict}</div>
            {verdict.reasoning && (
              <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{verdict.reasoning}</div>
            )}
          </div>
        </>
      )}

      {signals && Object.keys(signals).length > 0 && (
        <div className="space-y-2">
          {Object.entries(signals).slice(0, 8).map(([name, m]) => {
            const v = (m as any).value ?? 0
            const barColor = v >= 70 ? 'var(--success-text)' : v >= 55 ? 'var(--yellow-text)' : v >= 40 ? 'var(--warning-text)' : 'var(--danger-text)'
            return (
              <div key={name}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                  <span style={{ color: barColor }}>{v}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${Math.min(v, 100)}%`, background: barColor }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
        Gecached {new Date(entry.fetchedAt).toLocaleString('nl-NL')}
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function TickerUnifiedView() {
  const positions = useDashboardStore(s => s.positions)
  const watchlist = useDashboardStore(s => s.watchlist)
  const [ticker, setTicker] = useState('')

  const portTickers  = positions.map(p => p.ticker)
  const watchTickers = (watchlist ?? []).map(w => w.ticker).filter(t => !portTickers.includes(t))
  const allTickers   = [...portTickers, ...watchTickers]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>🎯 Per Aandeel · Unified Verdict</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.85 }}>
              Eén view per ticker: alle modules samengebracht in één conclusie. Geen losse rapporten.
            </div>
          </div>
          <select
            value={ticker}
            onChange={e => setTicker(e.target.value)}
            className="btn"
            style={{ fontSize: 12, padding: '6px 10px', minWidth: 220 }}
          >
            <option value="">Kies een ticker…</option>
            {portTickers.length > 0 && (
              <optgroup label="◇ Portfolio">
                {portTickers.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            )}
            {watchTickers.length > 0 && (
              <optgroup label="◆ Watchlist">
                {watchTickers.map(t => <option key={t} value={t}>{t}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--purple-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--purple-text)', lineHeight: 1.6 }}>
            Per ticker: <strong>Council + Validator + Smart Money + Earnings AI + Insider Flow</strong> samengevoegd.
            Toont positieve/negatieve modules, conflicten, finale aanbeveling en confidence-score.
          </div>
        </div>
      </div>

      {/* Empty state */}
      {!ticker && (
        <div className="surface p-8 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm font-semibold mb-1">Kies een aandeel</div>
          <div className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Selecteer een ticker om chart, verdict, signalen en positie-context inline te zien.
          </div>
          {allTickers.length === 0 ? (
            <div className="rounded p-3 text-xs inline-block" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)' }}>
              Voeg eerst posities of watchlist items toe via Portfolio → Posities.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center">
              {allTickers.slice(0, 12).map(t => (
                <button
                  key={t}
                  onClick={() => setTicker(t)}
                  className="rounded px-3 py-1.5 text-xs font-semibold transition"
                  style={{ background: 'var(--surface)', border: '0.5px solid var(--border)', color: 'var(--text-primary)' }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Per-ticker content */}
      {ticker && (
        <div className="space-y-4">
          <PositionCard ticker={ticker} />
          <TradingViewChart ticker={ticker} />
          <SignalSnapshot ticker={ticker} />
        </div>
      )}
    </div>
  )
}
