'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LegacyDashboardState, Position, WatchlistItem } from '@/lib/types/database'

// ── Types ──────────────────────────────────────────────────────

type MigrationStatus = 'idle' | 'parsing' | 'migrating' | 'done' | 'error'

interface MigrationResult {
  positions:   { success: number; failed: number }
  watchlist:   { success: number; failed: number }
  paperTrades: { success: number; failed: number }
  errors:      string[]
}

// ── Helpers ────────────────────────────────────────────────────

function legacyFactorScores(fs: unknown) {
  const f = (fs ?? {}) as Record<string, number>
  return {
    q: f.quality     ?? f.q ?? 0,
    g: f.growth      ?? f.g ?? 0,
    v: f.valuation   ?? f.v ?? 0,
    m: f.momentum    ?? f.m ?? 0,
    s: f.sentiment   ?? f.s ?? 0,
  }
}

// ── Component ──────────────────────────────────────────────────

export default function MigratePage() {
  const [status,   setStatus]   = useState<MigrationStatus>('idle')
  const [preview,  setPreview]  = useState<LegacyDashboardState | null>(null)
  const [result,   setResult]   = useState<MigrationResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const supabase = createClient()

  // ── Parse file ────────────────────────────────────────────────

  function parseFile(file: File) {
    setStatus('parsing')
    setErrorMsg(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const raw = JSON.parse(e.target?.result as string) as LegacyDashboardState
        setPreview(raw)
        setStatus('idle')
      } catch {
        setErrorMsg('Could not parse JSON. Make sure you exported the full state from the HTML dashboard.')
        setStatus('error')
      }
    }
    reader.readAsText(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) parseFile(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) parseFile(file)
  }, [])

  // ── Run migration ─────────────────────────────────────────────

  async function runMigration() {
    if (!preview) return
    setStatus('migrating')

    const result: MigrationResult = {
      positions:   { success: 0, failed: 0 },
      watchlist:   { success: 0, failed: 0 },
      paperTrades: { success: 0, failed: 0 },
      errors:      [],
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setErrorMsg('Not authenticated. Please sign in first.')
      setStatus('error')
      return
    }

    // supabase-js v2.105 + TS 5.9: insert/upsert conditional types don't resolve for
    // hand-written Database types. All data objects are fully typed before passing.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as Record<string, any>

    // ── Positions ────────────────────────────────────────────
    for (const p of preview.portfolio ?? []) {
      const pos = p as unknown as Position

      const { error } = await db.from('positions').upsert({
        user_id:       user.id,
        ticker:        pos.ticker,
        name:          pos.name,
        exchange:      pos.exchange ?? 'NYSE',
        sector:        pos.sector   ?? 'Unknown',
        sub_industry:  pos.subIndustry ?? null,
        shares:        pos.shares,
        avg_buy_price: pos.avgBuyPrice,
        current_price: pos.currentPrice,
        currency:      pos.currency ?? 'USD',
        factor_scores: legacyFactorScores(pos.factorScores),
        conviction:    pos.conviction ?? 3,
        thesis:        pos.thesis  || null,
        notes:         pos.notes   || null,
        added_at:      pos.addedDate ?? new Date().toISOString(),
      }, { onConflict: 'user_id,ticker', ignoreDuplicates: false })

      if (error) {
        result.positions.failed++
        result.errors.push(`Position ${pos.ticker}: ${error.message}`)
      } else {
        result.positions.success++
      }
    }

    // ── Watchlist ────────────────────────────────────────────
    for (const w of preview.watchlist ?? []) {
      const item = w as unknown as WatchlistItem

      const { error } = await db.from('watchlist').upsert({
        user_id:       user.id,
        ticker:        item.ticker,
        name:          item.name,
        exchange:      item.exchange      ?? 'NYSE',
        sector:        item.sector        ?? 'Unknown',
        sub_industry:  item.subIndustry   ?? null,
        current_price: item.currentPrice,
        score:         item.score         ?? 0,
        factor_scores: legacyFactorScores(item.factorScores),
        reason:        item.reason        || null,
        price_trigger: item.priceTrigger  ?? null,
        score_trigger: item.scoreTrigger  ?? null,
        conviction:    item.conviction    ?? 3,
        expiry_date:   item.expiryDate    ?? null,
        added_at:      item.addedDate     ?? new Date().toISOString(),
      }, { onConflict: 'user_id,ticker', ignoreDuplicates: false })

      if (error) {
        result.watchlist.failed++
        result.errors.push(`Watchlist ${item.ticker}: ${error.message}`)
      } else {
        result.watchlist.success++
      }
    }

    // ── Paper trades ─────────────────────────────────────────
    type LegacyTrade = {
      ticker: string; name?: string; action: string; shares: number
      entryPrice: number; entryDate: string; entryTimestamp: number
      stopLoss?: number; target1?: number; target2?: number
      verdictSnapshot?: unknown; evaluations?: unknown[]; status?: string; closedAt?: string
    }

    for (const t of (preview.paperTrades ?? []) as LegacyTrade[]) {
      const { error } = await db.from('paper_trades').insert({
        user_id:          user.id,
        ticker:           t.ticker,
        name:             t.name             ?? t.ticker,
        action:           (t.action as 'BUY' | 'SELL' | 'TRIM') ?? 'BUY',
        shares:           t.shares,
        entry_price:      t.entryPrice,
        entry_date:       t.entryDate,
        entry_timestamp:  t.entryTimestamp   ?? Date.now(),
        stop_loss:        t.stopLoss         ?? null,
        target_1:         t.target1          ?? null,
        target_2:         t.target2          ?? null,
        verdict_snapshot: t.verdictSnapshot  ?? null,
        evaluations:      t.evaluations      ?? [],
        status:           (t.status as 'open' | 'closed') ?? 'open',
        closed_at:        t.closedAt         ?? null,
      })

      if (error) {
        result.paperTrades.failed++
        result.errors.push(`Paper trade ${t.ticker}: ${error.message}`)
      } else {
        result.paperTrades.success++
      }
    }

    setResult(result)
    setStatus('done')
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Import from Legacy Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Export your state from the HTML dashboard, then drop the JSON file below.
            Your positions, watchlist, and paper trades will be imported into Supabase.
          </p>
        </div>

        {/* How to export */}
        <details className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-zinc-300 select-none">
            How to export from the HTML dashboard
          </summary>
          <ol className="mt-3 space-y-1.5 text-zinc-400 list-decimal list-inside">
            <li>Open the HTML dashboard in your browser</li>
            <li>Open DevTools → Console (F12)</li>
            <li>Run: <code className="bg-zinc-800 px-1 rounded text-zinc-200">copy(localStorage.getItem('p3_stock_dashboard_v01'))</code></li>
            <li>Paste into a text file and save as <code className="bg-zinc-800 px-1 rounded text-zinc-200">export.json</code></li>
            <li>Drop the file below</li>
          </ol>
        </details>

        {/* Drop zone */}
        {status !== 'done' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`
              relative rounded-xl border-2 border-dashed p-10 text-center transition
              ${dragOver
                ? 'border-indigo-500 bg-indigo-950/20'
                : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600'}
            `}
          >
            <input
              type="file"
              accept=".json"
              onChange={handleFileInput}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <p className="text-3xl mb-2">📂</p>
            <p className="text-sm font-medium text-zinc-300">Drop your export.json here</p>
            <p className="text-xs text-zinc-500 mt-1">or click to browse</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && errorMsg && (
          <div className="mt-4 rounded-lg bg-red-900/20 border border-red-800 px-4 py-3 text-sm text-red-400">
            {errorMsg}
          </div>
        )}

        {/* Preview */}
        {preview && status !== 'done' && (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="text-sm font-semibold text-white mb-3">Preview</h2>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <PreviewStat label="Positions"   count={preview.portfolio?.length   ?? 0} />
              <PreviewStat label="Watchlist"   count={preview.watchlist?.length   ?? 0} />
              <PreviewStat label="Paper Trades" count={(preview.paperTrades as unknown[])?.length ?? 0} />
            </div>

            <button
              onClick={runMigration}
              disabled={status === 'migrating'}
              className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition"
            >
              {status === 'migrating' ? 'Importing…' : 'Start import'}
            </button>
          </div>
        )}

        {/* Result */}
        {status === 'done' && result && (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4 space-y-4">
            <h2 className="text-sm font-semibold text-white">Import complete</h2>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <ResultStat label="Positions"   ok={result.positions.success}   fail={result.positions.failed} />
              <ResultStat label="Watchlist"   ok={result.watchlist.success}   fail={result.watchlist.failed} />
              <ResultStat label="Paper Trades" ok={result.paperTrades.success} fail={result.paperTrades.failed} />
            </div>

            {result.errors.length > 0 && (
              <details className="text-xs text-red-400">
                <summary className="cursor-pointer">{result.errors.length} error(s)</summary>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}

            <a
              href="/dashboard"
              className="block w-full text-center rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition"
            >
              Go to dashboard →
            </a>
          </div>
        )}
      </div>
    </main>
  )
}

// ── Mini components ────────────────────────────────────────────

function PreviewStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg bg-zinc-800 px-3 py-2 text-center">
      <p className="text-xl font-bold text-white">{count}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  )
}

function ResultStat({ label, ok, fail }: { label: string; ok: number; fail: number }) {
  return (
    <div className="rounded-lg bg-zinc-800 px-3 py-2 text-center">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <p className="text-sm font-semibold text-emerald-400">{ok} ✓</p>
      {fail > 0 && <p className="text-sm font-semibold text-red-400">{fail} ✗</p>}
    </div>
  )
}
