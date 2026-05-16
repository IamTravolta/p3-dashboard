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
      <div>
        <h2 className="text-lg font-semibold text-white">Options Strategies</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Covered calls and cash-secured puts</p>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-xs text-zinc-400">
        <Info size={14} className="shrink-0 mt-0.5 text-zinc-500" />
        <span>
          <strong className="text-zinc-300">Estimates only</strong> — premiums use a 2% ATR placeholder.
          Use your broker for accurate option pricing. Annualized yield assumes monthly roll.
        </span>
      </div>

      {/* Covered Calls */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Covered Calls</h3>
        <p className="text-xs text-zinc-600 mb-3">Based on your current portfolio positions (5% OTM strike)</p>
        {coveredCallRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
            Add positions to your portfolio to see covered call estimates.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  {['Ticker', 'Current Price', 'Strike (5% OTM)', 'Est. Premium', 'Ann. Yield %'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {coveredCallRows.map((r) => (
                  <tr key={r.ticker} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 font-bold text-white">{r.ticker}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {r.price > 0 ? fmtCcy(r.price) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {r.price > 0 ? fmtCcy(r.strike) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-400">
                      {r.price > 0 ? fmtCcy(r.premium) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.price > 0 ? (
                        <span className="font-mono font-semibold text-emerald-400">{fmt(r.yield)}%</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
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
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Cash-Secured Puts</h3>
        <p className="text-xs text-zinc-600 mb-3">Based on your watchlist (5% OTM strike — buying at a discount)</p>
        {cspRows.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
            Add tickers to your watchlist to see cash-secured put estimates.
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  {['Ticker', 'Current Price', 'Strike (5% OTM)', 'Est. Premium', 'Ann. Yield %'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cspRows.map((r) => (
                  <tr key={r.ticker} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition">
                    <td className="px-4 py-3 font-bold text-white">{r.ticker}</td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {r.price > 0 ? fmtCcy(r.price) : <span className="text-zinc-600">No price</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-300">
                      {r.price > 0 ? fmtCcy(r.strike) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-indigo-400">
                      {r.price > 0 ? fmtCcy(r.premium) : <span className="text-zinc-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {r.price > 0 ? (
                        <span className="font-mono font-semibold text-indigo-400">{fmt(r.yield)}%</span>
                      ) : (
                        <span className="text-zinc-600">—</span>
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
