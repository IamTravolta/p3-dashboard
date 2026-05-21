'use client'

import { useState, useEffect, useRef } from 'react'
import { useDashboardStore } from '@/lib/store'
import { computeQuickProTrader, type QuickAction } from '@/lib/utils/quickProTrader'

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
            Live candles + volume + RSI. Switch interval below.
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
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--info-text)' }}>◇ Position context</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Shares</div>
          <div className="text-lg font-semibold mt-0.5">{pos.shares}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Avg buy price</div>
          <div className="text-lg font-semibold mt-0.5">€{pos.avgBuyPrice.toFixed(2)}</div>
        </div>
        <div className="kpi-card">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Value</div>
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

// ── Thesis panel ─────────────────────────────────────────────────────────────
function ThesisPanel({ ticker }: { ticker: string }) {
  const positions = useDashboardStore(s => s.positions)
  const watchlist = useDashboardStore(s => s.watchlist)
  const pos  = positions.find(p => p.ticker === ticker)
  const wat  = watchlist.find(w => w.ticker === ticker)
  const text = pos?.thesis ?? wat?.reason ?? ''

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid var(--yellow-text)' }}>
      <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--yellow-text)' }}>📝 Investment Thesis</h3>
      {text ? (
        <div className="rounded p-3" style={{ background: 'var(--yellow-bg)' }}>
          <p className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.7 }}>{text}</p>
        </div>
      ) : (
        <div className="rounded p-3" style={{ background: 'var(--bg)', border: '1px dashed var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            Geen thesis opgeslagen voor {ticker}. Voeg toe via Portfolio → Posities → bewerk positie.
          </p>
        </div>
      )}
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
          No signal data for {ticker} yet. Use Action Center to sync signals.
        </p>
      </div>
    )
  }

  const verdict = entry.verdict
  const signals = entry.signals as Record<string, { value?: number; label?: string }> | undefined
  const bullish = Object.entries(signals ?? {}).filter(([, m]) => ((m as any).value ?? 0) >= 60)
  const bearish = Object.entries(signals ?? {}).filter(([, m]) => ((m as any).value ?? 0) < 40)

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
        <div className="rounded p-2.5 mb-3" style={{ background: 'var(--purple-bg)' }}>
          <div className="text-sm font-bold" style={{ color: 'var(--purple-text)' }}>{verdict.finalVerdict}</div>
          {verdict.reasoning && (
            <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{verdict.reasoning}</div>
          )}
        </div>
      )}

      {signals && Object.keys(signals).length > 0 && (
        <>
          {bullish.length > 0 && (
            <div className="mb-2">
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--success-text)' }}>↑ Bullish modules</div>
              <div className="space-y-1.5">
                {bullish.slice(0, 5).map(([name, m]) => {
                  const v = (m as any).value ?? 0
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                        <span style={{ color: 'var(--success-text)' }}>{v}</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.min(v, 100)}%`, background: 'var(--success-text)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          {bearish.length > 0 && (
            <div className="mt-2">
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--danger-text)' }}>↓ Bearish modules</div>
              <div className="space-y-1.5">
                {bearish.slice(0, 3).map(([name, m]) => {
                  const v = (m as any).value ?? 0
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-0.5">
                        <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                        <span style={{ color: 'var(--danger-text)' }}>{v}</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${Math.min(v, 100)}%`, background: 'var(--danger-text)' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
        Cached {new Date(entry.fetchedAt).toLocaleString('nl-NL')}
      </div>
    </div>
  )
}

// ── Quick Pro Trader panel ────────────────────────────────────────────────────
const ACTION_STYLE: Record<QuickAction, { bg: string; text: string; icon: string }> = {
  STRONG_BUY: { bg: 'var(--success-bg)', text: 'var(--success-text)', icon: '⭐⭐' },
  BUY:        { bg: 'var(--success-bg)', text: 'var(--success-text)', icon: '⭐'  },
  HOLD:       { bg: 'var(--info-bg)',    text: 'var(--info-text)',    icon: '◐'   },
  TRIM:       { bg: 'var(--warning-bg)', text: 'var(--warning-text)', icon: '↓'  },
  EXIT:       { bg: 'var(--danger-bg)',  text: 'var(--danger-text)',  icon: '⛔'  },
  AVOID:      { bg: 'var(--bg)',         text: 'var(--text-tertiary)', icon: '–'  },
}

function QuickProTraderPanel({ ticker }: { ticker: string }) {
  const positions   = useDashboardStore(s => s.positions)
  const watchlist   = useDashboardStore(s => s.watchlist)
  const prices      = useDashboardStore(s => s.prices)
  const signalCache = useDashboardStore(s => s.signalCache)

  const pos     = positions.find(p => p.ticker === ticker)
  const price   = prices[ticker] ?? pos?.currentPrice ?? 0
  const verdict = signalCache[ticker]?.verdict ?? null

  const q = computeQuickProTrader(ticker, price, positions, watchlist, prices, verdict)

  if (!q) {
    return (
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--primary)' }}>💼 Pro Trader Analysis</h3>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          No live price available for {ticker} — unable to compute analysis.
        </p>
      </div>
    )
  }

  const style = ACTION_STYLE[q.action]

  // Action instruction box
  const instructionContent = (() => {
    if (q.action === 'EXIT' && q.trim_shares)
      return { bg: 'var(--danger-bg)', text: 'var(--danger-text)', msg: `📤 SELL ALL ${q.trim_shares} shares (~€${q.trim_eur?.toLocaleString('nl-NL')}) · close position fully` }
    if (q.action === 'TRIM' && q.trim_shares)
      return { bg: 'var(--warning-bg)', text: 'var(--warning-text)', msg: `📤 SELL ${q.trim_shares} of ${q.current_shares} shares (~€${q.trim_eur?.toLocaleString('nl-NL')}, ${q.trim_pct}%) · keep ${q.keep_shares} shares` }
    if ((q.action === 'BUY' || q.action === 'STRONG_BUY') && q.buy_shares)
      return { bg: 'var(--success-bg)', text: 'var(--success-text)', msg: `📥 BUY ${q.buy_shares} shares (~€${q.buy_eur?.toLocaleString('nl-NL')}) · target ${q.position_size_pct}% portfolio` }
    return null
  })()

  return (
    <div className="surface p-4" style={{ borderLeft: '4px solid var(--primary)' }}>
      <div className="flex justify-between items-start gap-3 flex-wrap mb-3">
        <div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--primary)' }}>💼 Pro Trader Analysis</h3>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Quick (instant, rule-based) · Deep AI via Railway backend
          </div>
        </div>
        <span className="pill" style={{ background: style.bg, color: style.text, fontWeight: 600, fontSize: 12 }}>
          {style.icon} {q.action}
        </span>
      </div>

      {/* Quick analysis block */}
      <div className="rounded p-3" style={{ background: 'var(--bg)', border: '1px dashed var(--border)' }}>
        <div className="text-xs font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>⚡ Quick Analysis (rule-based)</div>
        <div className="text-sm font-bold mb-1" style={{ color: style.text }}>{q.action} · {q.confidence}% confidence</div>
        <div className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{q.one_liner}</div>

        {instructionContent && (
          <div className="rounded p-2 mb-2 font-semibold" style={{ background: instructionContent.bg, color: instructionContent.text, fontSize: 12 }}>
            {instructionContent.msg}
          </div>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <span><strong style={{ color: 'var(--text-secondary)' }}>Entry:</strong> €{q.entry_level}</span>
          <span><strong style={{ color: 'var(--text-secondary)' }}>Stop:</strong> €{q.stop_loss}</span>
          <span><strong style={{ color: 'var(--text-secondary)' }}>TP1:</strong> €{q.take_profit_1}</span>
          <span><strong style={{ color: 'var(--text-secondary)' }}>TP2:</strong> €{q.take_profit_2}</span>
          <span><strong style={{ color: 'var(--text-secondary)' }}>R/R:</strong> {q.risk_reward_ratio}x</span>
          <span><strong style={{ color: 'var(--text-secondary)' }}>Size:</strong> {q.position_size_pct}%</span>
          <span><strong style={{ color: 'var(--text-secondary)' }}>Horizon:</strong> {q.time_horizon}</span>
        </div>
        <div className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          <strong>Risk:</strong> {q.key_risk} · <strong>Catalyst:</strong> {q.key_catalyst}
        </div>
      </div>

      {/* Stop loss & trim zone visual */}
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded p-2 text-center" style={{ background: 'var(--danger-bg)' }}>
          <div style={{ color: 'var(--danger-text)', fontWeight: 600 }}>Stop Loss</div>
          <div style={{ color: 'var(--danger-text)', fontSize: 14, fontWeight: 700 }}>€{q.stop_loss}</div>
          <div style={{ color: 'var(--text-tertiary)' }}>−{((1 - q.stop_loss / q.entry_level) * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: 'var(--bg)', border: '0.5px solid var(--border)' }}>
          <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Entry</div>
          <div style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 700 }}>€{q.entry_level}</div>
          <div style={{ color: 'var(--text-tertiary)' }}>now</div>
        </div>
        <div className="rounded p-2 text-center" style={{ background: 'var(--success-bg)' }}>
          <div style={{ color: 'var(--success-text)', fontWeight: 600 }}>Target 1</div>
          <div style={{ color: 'var(--success-text)', fontSize: 14, fontWeight: 700 }}>€{q.take_profit_1}</div>
          <div style={{ color: 'var(--text-tertiary)' }}>+{((q.take_profit_1 / q.entry_level - 1) * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}

// ── Main view ─────────────────────────────────────────────────────────────────
export default function TickerUnifiedView() {
  const positions = useDashboardStore(s => s.positions)
  const watchlist = useDashboardStore(s => s.watchlist)
  const activeTicker = useDashboardStore(s => s.activeTicker)
  const [ticker, setTicker] = useState(activeTicker ?? '')

  useEffect(() => {
    if (activeTicker) setTicker(activeTicker)
  }, [activeTicker])

  const portTickers  = positions.map(p => p.ticker)
  const watchTickers = (watchlist ?? []).map(w => w.ticker).filter(t => !portTickers.includes(t))
  const allTickers   = [...portTickers, ...watchTickers]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>🎯 Per Aandeel · Unified View</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.85 }}>
              Chart · Verdict · Pro Trader · Thesis — alles per ticker inline
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
      </div>

      {/* Empty state */}
      {!ticker && (
        <div className="surface p-8 text-center">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm font-semibold mb-1">Kies een aandeel</div>
          <div className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
            Selecteer een ticker om chart, verdict, Pro Trader analyse en thesis inline te zien.
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
          <QuickProTraderPanel ticker={ticker} />
          <SignalSnapshot ticker={ticker} />
          <ThesisPanel ticker={ticker} />
        </div>
      )}
    </div>
  )
}
