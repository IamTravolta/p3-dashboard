'use client'

import { useState, useEffect, useCallback } from 'react'
import { Brain, TrendingUp, AlertCircle } from 'lucide-react'

interface BehavioralEntry {
  id:                    string
  ticker:                string | null
  action_type:           string
  system_recommendation: string | null
  user_action:           string
  followed_advice:       boolean | null
  context:               Record<string, unknown> | null
  created_at:            string
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
      const resp = await fetch('/api/behavioral-log?limit=100')
      if (!resp.ok) return
      const { data } = await resp.json() as { data: BehavioralEntry[] }

      const rows = (data ?? []) as BehavioralEntry[]
      setEntries(rows)

      // Compute stats
      const total      = rows.length
      const followed   = rows.filter((r) => r.followed_advice === true).length
      const overridden = rows.filter((r) => r.followed_advice === false).length
      const ignored    = rows.filter((r) => r.followed_advice === null).length

      setStats({
        totalVerdicts:   total,
        followed,
        overridden,
        ignored,
        followWinRate:   0,
        overrideWinRate: 0,
        followedCount:   followed,
        overriddenCount: overridden,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const actionColor = (followed: boolean | null) =>
    followed === true  ? 'text-emerald-400 bg-emerald-900/30' :
    followed === false ? 'text-amber-400 bg-amber-900/30' : 'text-zinc-400 bg-zinc-800'

  const actionLabel = (followed: boolean | null) =>
    followed === true ? 'FOLLOWED' : followed === false ? 'OVERRIDDEN' : 'IGNORED'

  const insight = () => {
    if (!stats || stats.followedCount < 3 && stats.overriddenCount < 3) return null
    if (stats.overriddenCount > stats.followedCount * 2) {
      return { text: 'You override recommendations frequently. Review your system settings to see if calibration is needed.', type: 'positive' }
    }
    if (stats.followedCount > stats.overriddenCount * 2) {
      return { text: 'You follow recommendations closely. Consider whether personal conviction should play a larger role.', type: 'info' }
    }
    return { text: 'Your override and follow balance looks healthy. Signals and intuition appear aligned.', type: 'neutral' }
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

      {/* Follow vs override breakdown */}
      {stats && stats.totalVerdicts > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-emerald-400"><TrendingUp size={14} /></span>
              <p className="text-xs text-zinc-400">Followed advice</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{stats.followedCount}</p>
            <p className="text-xs text-zinc-600 mt-1">decisions</p>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-amber-400"><Brain size={14} /></span>
              <p className="text-xs text-zinc-400">Overrode advice</p>
            </div>
            <p className="text-2xl font-bold text-amber-400">{stats.overriddenCount}</p>
            <p className="text-xs text-zinc-600 mt-1">decisions</p>
          </div>
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
                {['Ticker', 'Action Type', 'Recommendation', 'Your action', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition">
                  <td className="px-4 py-3 font-semibold text-white">{e.ticker ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{e.action_type}</td>
                  <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{e.system_recommendation ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionColor(e.followed_advice)}`}>
                      {actionLabel(e.followed_advice)}
                    </span>
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


/* ── Log decision modal ─────────────────────────────────────────────────────── */
const INPUT = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition'

function LogDecisionModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({
    ticker:                '',
    action_type:           'TRADE_DECISION',
    system_recommendation: '',
    followed_advice:       'true',
    context_note:          '',
  })
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await fetch('/api/behavioral-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action_type:           form.action_type,
        ticker:                form.ticker.toUpperCase() || null,
        system_recommendation: form.system_recommendation || null,
        user_action:           form.followed_advice === 'true' ? 'FOLLOWED' : form.followed_advice === 'false' ? 'OVERRIDDEN' : 'IGNORED',
        followed_advice:       form.followed_advice === 'true' ? true : form.followed_advice === 'false' ? false : null,
        context:               form.context_note ? { note: form.context_note } : null,
      }),
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
              <label className="text-xs text-zinc-400">Ticker (optional)</label>
              <input value={form.ticker} onChange={(e) => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))} className={INPUT} placeholder="NVDA" />
            </div>
            <div>
              <label className="text-xs text-zinc-400">Action type</label>
              <select value={form.action_type} onChange={(e) => setForm(f => ({ ...f, action_type: e.target.value }))} className={INPUT}>
                {['TRADE_DECISION', 'REBALANCE', 'HEDGE', 'WATCHLIST_REVIEW', 'OTHER'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400">System recommendation</label>
            <input value={form.system_recommendation} onChange={(e) => setForm(f => ({ ...f, system_recommendation: e.target.value }))} className={INPUT} placeholder="BUY, SELL, HOLD, or description…" />
          </div>
          <div>
            <label className="text-xs text-zinc-400">Did you follow the recommendation?</label>
            <select value={form.followed_advice} onChange={(e) => setForm(f => ({ ...f, followed_advice: e.target.value }))} className={INPUT}>
              <option value="true">Yes — followed</option>
              <option value="false">No — overridden</option>
              <option value="null">Ignored / no action</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-400">Notes (optional)</label>
            <textarea rows={2} value={form.context_note} onChange={(e) => setForm(f => ({ ...f, context_note: e.target.value }))} placeholder="Reasoning, market conditions, conviction…" className={`${INPUT} resize-none`} />
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
