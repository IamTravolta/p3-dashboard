'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, TrendingUp, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface BehavioralEntry {
  id:             string
  ticker:         string
  verdict:        'BUY' | 'SELL' | 'HOLD'
  user_action:    'FOLLOWED' | 'OVERRIDDEN' | 'IGNORED'
  override_reason: string | null
  actual_outcome:  'WIN' | 'LOSS' | 'NEUTRAL' | null
  created_at:     string
}

interface Stats {
  totalVerdicts:    number
  followed:         number
  overridden:       number
  ignored:          number
  followWinRate:    number
  overrideWinRate:  number
  followedCount:    number
  overriddenCount:  number
}

export default function BehavioralView() {
  const [entries,  setEntries]  = useState<BehavioralEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showLog,  setShowLog]  = useState(false)
  const [stats,    setStats]    = useState<Stats | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('behavioral_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      const rows = (data ?? []) as BehavioralEntry[]
      setEntries(rows)

      // Compute stats
      const total       = rows.length
      const followed    = rows.filter((r) => r.user_action === 'FOLLOWED').length
      const overridden  = rows.filter((r) => r.user_action === 'OVERRIDDEN').length
      const ignored     = rows.filter((r) => r.user_action === 'IGNORED').length

      const followWins   = rows.filter((r) => r.user_action === 'FOLLOWED'   && r.actual_outcome === 'WIN').length
      const overrideWins = rows.filter((r) => r.user_action === 'OVERRIDDEN' && r.actual_outcome === 'WIN').length
      const followedEval   = rows.filter((r) => r.user_action === 'FOLLOWED'   && r.actual_outcome).length
      const overriddenEval = rows.filter((r) => r.user_action === 'OVERRIDDEN' && r.actual_outcome).length

      setStats({
        totalVerdicts:   total,
        followed,
        overridden,
        ignored,
        followWinRate:   followedEval   > 0 ? followWins   / followedEval   : 0,
        overrideWinRate: overriddenEval > 0 ? overrideWins / overriddenEval : 0,
        followedCount:   followedEval,
        overriddenCount: overriddenEval,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const actionColor = (a: string) =>
    a === 'FOLLOWED' ? 'text-emerald-400 bg-emerald-900/30' :
    a === 'OVERRIDDEN' ? 'text-amber-400 bg-amber-900/30' : 'text-zinc-400 bg-zinc-800'

  const outcomeColor = (o: string | null) =>
    o === 'WIN' ? 'text-emerald-400' : o === 'LOSS' ? 'text-red-400' : 'text-zinc-500'

  const insight = () => {
    if (!stats || stats.followedCount < 3 && stats.overriddenCount < 3) return null
    if (stats.overrideWinRate > stats.followWinRate + 0.15) {
      return { text: 'Your overrides are outperforming signal recommendations. Consider adjusting signal weights.', type: 'positive' }
    }
    if (stats.followWinRate > stats.overrideWinRate + 0.15) {
      return { text: 'Following recommendations is more profitable than overriding. Trust the signals more.', type: 'info' }
    }
    return { text: 'Your override and follow win rates are similar. Signals and intuition align.', type: 'neutral' }
  }

  const ins = insight()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Behavioral Intelligence</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Track when you follow or override AI recommendations — and the outcome</p>
        </div>
        <button
          onClick={() => setShowLog(true)}
          className="flex items-center gap-1.5 rounded-lg bg-zinc-700 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-600 transition"
        >
          <Brain size={14} /> Log decision
        </button>
      </div>

      {/* Insight banner */}
      {ins && (
        <div className={`flex items-start gap-3 rounded-xl border p-4 ${ins.type === 'positive' ? 'border-emerald-800 bg-emerald-900/20' : ins.type === 'info' ? 'border-indigo-800 bg-indigo-900/20' : 'border-zinc-700 bg-zinc-800/40'}`}>
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-zinc-400" />
          <p className="text-sm text-zinc-300">{ins.text}</p>
        </div>
      )}

      {/* Stats grid */}
      {stats && stats.totalVerdicts > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Verdicts logged"   value={stats.totalVerdicts.toString()} />
          <StatCard label="Followed"           value={`${stats.followed} (${stats.totalVerdicts > 0 ? Math.round(stats.followed / stats.totalVerdicts * 100) : 0}%)`} color="text-emerald-400" />
          <StatCard label="Overridden"         value={`${stats.overridden} (${stats.totalVerdicts > 0 ? Math.round(stats.overridden / stats.totalVerdicts * 100) : 0}%)`} color="text-amber-400" />
          <StatCard label="Ignored"            value={stats.ignored.toString()} color="text-zinc-500" />
        </div>
      )}

      {/* Win rates */}
      {stats && (stats.followedCount > 0 || stats.overriddenCount > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <WinRateCard
            label="Follow win rate"
            rate={stats.followWinRate}
            count={stats.followedCount}
            color="text-emerald-400"
            icon={<TrendingUp size={14} />}
          />
          <WinRateCard
            label="Override win rate"
            rate={stats.overrideWinRate}
            count={stats.overriddenCount}
            color="text-amber-400"
            icon={<Brain size={14} />}
          />
        </div>
      )}

      {/* Log table */}
      {loading ? (
        <div className="py-10 text-center text-zinc-500 text-sm">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-10 text-center text-zinc-500 text-sm">
          No behavioral decisions logged yet. Start by logging a verdict action.
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/80">
                {['Ticker', 'Verdict', 'Your action', 'Reason', 'Outcome', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition">
                  <td className="px-4 py-3 font-semibold text-white">{e.ticker}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.verdict === 'BUY' ? 'bg-emerald-900/40 text-emerald-400' : e.verdict === 'SELL' ? 'bg-red-900/40 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                      {e.verdict}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionColor(e.user_action)}`}>
                      {e.user_action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{e.override_reason ?? '—'}</td>
                  <td className={`px-4 py-3 text-xs font-medium ${outcomeColor(e.actual_outcome)}`}>
                    {e.actual_outcome ?? 'Pending'}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(e.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showLog && <LogDecisionModal onClose={() => { setShowLog(false); load() }} />}
    </div>
  )
}

/* ── Stat card ─────────────────────────────────────────────────────────────── */
function StatCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-lg font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  )
}

function WinRateCard({ label, rate, count, color, icon }: { label: string; rate: number; count: number; color: string; icon: React.ReactNode }) {
  const pct = Math.round(rate * 100)
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <p className="text-xs text-zinc-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{pct}%</p>
      <div className="mt-2 h-1.5 w-full rounded-full bg-zinc-700">
        <div className={`h-1.5 rounded-full ${color.replace('text-', 'bg-')}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-zinc-600 mt-1">{count} evaluated trades</p>
    </div>
  )
}

/* ── Log decision modal ─────────────────────────────────────────────────────── */
const INPUT = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

function LogDecisionModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    ticker: '', verdict: 'BUY', user_action: 'FOLLOWED', override_reason: '', actual_outcome: '',
  })
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('behavioral_log')
      .insert({
        user_id:         user.id,
        ticker:          form.ticker.toUpperCase(),
        verdict:         form.verdict,
        user_action:     form.user_action,
        override_reason: form.override_reason || null,
        actual_outcome:  form.actual_outcome || null,
        created_at:      new Date().toISOString(),
      })

    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h3 className="font-semibold text-white">Log a decision</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">✕</button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400">Ticker</label>
              <input required value={form.ticker} onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} className={INPUT} placeholder="NVDA" />
            </div>
            <div>
              <label className="text-xs text-zinc-400">AI verdict was</label>
              <select value={form.verdict} onChange={(e) => setForm(f => ({ ...f, verdict: e.target.value }))} className={INPUT}>
                {['BUY','SELL','HOLD'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Your action</label>
            <select value={form.user_action} onChange={(e) => setForm(f => ({ ...f, user_action: e.target.value }))} className={INPUT}>
              <option value="FOLLOWED">FOLLOWED (did what was recommended)</option>
              <option value="OVERRIDDEN">OVERRIDDEN (did the opposite)</option>
              <option value="IGNORED">IGNORED (took no action)</option>
            </select>
          </div>
          {form.user_action === 'OVERRIDDEN' && (
            <div>
              <label className="text-xs text-zinc-400">Why did you override?</label>
              <textarea rows={2} value={form.override_reason} onChange={(e) => setForm(f => ({ ...f, override_reason: e.target.value }))} placeholder="Market conditions, personal conviction, news…" className={`${INPUT} resize-none`} />
            </div>
          )}
          <div>
            <label className="text-xs text-zinc-400">Outcome (leave blank if pending)</label>
            <select value={form.actual_outcome} onChange={(e) => setForm(f => ({ ...f, actual_outcome: e.target.value }))} className={INPUT}>
              <option value="">Pending</option>
              <option value="WIN">WIN (profitable)</option>
              <option value="LOSS">LOSS (unprofitable)</option>
              <option value="NEUTRAL">NEUTRAL (break even)</option>
            </select>
          </div>
          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
            <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg bg-indigo-600 text-sm text-white hover:bg-indigo-500 disabled:opacity-50">{loading ? 'Saving…' : 'Log decision'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
