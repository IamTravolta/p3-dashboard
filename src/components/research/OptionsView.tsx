'use client'

import { useDashboardStore } from '@/lib/store'
import { Info } from 'lucide-react'

const PREMIUM_FACTOR   = 0.02   // 2% of price as estimated premium
const DAYS_IN_CYCLE    = 30
const DAYS_IN_YEAR     = 365

function estimatePremium(price: number): number {
  return price * PREMIUM_FACTOR
}

function annualizedYield(price: number, premium: number): number {
  return (premium / price) * (DAYS_IN_YEAR / DAYS_IN_CYCLE) * 100
}

function fmt(n: number, dec = 2): string {
  return n.toFixed(dec)
}

function fmtCcy(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n)
}

export default function OptionsView() {
  const positions = useDashboardStore((s) => s.positions)
  const watchlist = useDashboardStore((s) => s.watchlist)
  const prices    = useDashboardStore((s) => s.prices)

  // Covered calls — use portfolio positions
  const coveredCallRows = positions.map((p) => {
    const price   = prices[p.ticker] ?? p.currentPrice ?? 0
    const strike  = price * 1.05
    const premium = estimatePremium(price)
    const yield_  = annualizedYield(price, premium)
    return { ticker: p.ticker, price, strike, premium, yield: yield_ }
  })

  // Cash-secured puts — use watchlist
  const cspRows = watchlist.map((w) => {
    const price   = prices[w.ticker] ?? 0
    const strike  = price * 0.95
    const premium = estimatePremium(price)
    const yield_  = price > 0 ? annualizedYield(price, premium) : 0
    return { ticker: w.ticker, price, strike, premium, yield: yield_ }
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="surface p-4" style={{ borderLeft: '4px solid var(--purple-text)' }}>
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--purple-text)' }}>▲ Options Trading</h1>
            <div className="text-xs mt-1" style={{ color: 'var(--purple-text)', opacity: 0.7 }}>Top upside stocks for options · linked to Smart Money and Prediction Markets</div>
          </div>
        </div>
        <div className="rounded p-2.5 mt-3" style={{ background: 'var(--purple-bg)' }}>
          <div className="text-xs" style={{ color: 'var(--purple-text)', lineHeight: 1.6 }}>What are options? A call option gives you the right to buy a stock at a set price (strike) before expiry. You pay a premium.</div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl p-4 text-xs" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
        <Info size={14} className="shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }} />
        <span>
          <strong style={{ color: 'var(--text-primary)' }}>Estimates only</strong> — premiums use a 2% ATR placeholder.
          Use your broker for accurate option pricing. Annualized yield assumes monthly roll.
        </span>
      </div>

      {/* Covered Calls */}
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Covered Calls</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>Based on your current portfolio positions (5% OTM strike)</p>
        {coveredCallRows.length === 0 ? (
          <div className="surface p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Add positions to your portfolio to see covered call estimates.
          </div>
        ) : (
          <div className="surface overflow-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['Ticker', 'Current Price', 'Strike (5% OTM)', 'Est. Premium', 'Ann. Yield %'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coveredCallRows.map((r) => (
                  <tr key={r.ticker} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{r.ticker}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {r.price > 0 ? fmtCcy(r.price) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {r.price > 0 ? fmtCcy(r.strike) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--success-text)' }}>
                      {r.price > 0 ? fmtCcy(r.premium) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.price > 0 ? (
                        <span className="font-mono font-semibold" style={{ color: 'var(--success-text)' }}>{fmt(r.yield)}%</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cash-Secured Puts */}
      <div>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Cash-Secured Puts</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>Based on your watchlist (5% OTM strike — buying at a discount)</p>
        {cspRows.length === 0 ? (
          <div className="surface p-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
            Add tickers to your watchlist to see cash-secured put estimates.
          </div>
        ) : (
          <div className="surface overflow-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr style={{ borderBottom: '0.5px solid var(--border)' }}>
                  {['Ticker', 'Current Price', 'Strike (5% OTM)', 'Est. Premium', 'Ann. Yield %'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cspRows.map((r) => (
                  <tr key={r.ticker} style={{ borderBottom: '0.5px solid var(--border)' }}>
                    <td className="px-4 py-3 font-bold" style={{ color: 'var(--text-primary)' }}>{r.ticker}</td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {r.price > 0 ? fmtCcy(r.price) : <span style={{ color: 'var(--text-tertiary)' }}>No price</span>}
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--text-secondary)' }}>
                      {r.price > 0 ? fmtCcy(r.strike) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono" style={{ color: 'var(--info-text)' }}>
                      {r.price > 0 ? fmtCcy(r.premium) : <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.price > 0 ? (
                        <span className="font-mono font-semibold" style={{ color: 'var(--info-text)' }}>{fmt(r.yield)}%</span>
                      ) : (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
