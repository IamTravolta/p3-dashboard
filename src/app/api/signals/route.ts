/**
 * POST /api/signals
 * Body: { ticker: string, exchange?: string }
 *
 * 1. Forwards the request to the Railway backend's /analyze endpoint
 * 2. Persists returned signals to the signals table in Supabase
 * 3. Returns the full signal + verdict to the client
 *
 * The Railway backend returns something like:
 * {
 *   signals: {
 *     technical:   { value: 'BULLISH', confidence: 0.78, reasoning: '...' },
 *     polymarket:  { value: 'BEARISH', confidence: 0.65, reasoning: '...' },
 *     sentiment:   { value: 'NEUTRAL', confidence: 0.50, reasoning: '...' },
 *     ...
 *   },
 *   verdict: {
 *     finalVerdict: 'BUY',
 *     confidence: 0.72,
 *     reasoning: '...'
 *   },
 *   price: 213.45
 * }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BACKEND_URL = process.env.BACKEND_URL

interface BackendSignal {
  value:      string
  confidence: number
  reasoning?: string
  raw_data?:  unknown
}

interface BackendResponse {
  signals?: Record<string, BackendSignal>
  verdict?: {
    finalVerdict: string
    confidence:   number
    reasoning?:   string
  }
  price?:   number
  error?:   string
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { ticker, exchange = 'NYSE' } = await request.json() as { ticker: string; exchange?: string }

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 })
  }

  if (!BACKEND_URL) {
    return NextResponse.json(
      { error: 'BACKEND_URL not configured — add it to .env.local' },
      { status: 503 }
    )
  }

  // ── Call Railway backend ────────────────────────────────────────────────────
  let backendData: BackendResponse = {}
  try {
    const resp = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/analyze`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id':    user.id,
      },
      body:    JSON.stringify({ ticker: ticker.toUpperCase(), exchange }),
      signal:  AbortSignal.timeout(30_000),
    })
    backendData = await resp.json() as BackendResponse
  } catch (err) {
    console.error('[signals] backend error:', err)
    return NextResponse.json(
      { error: 'Backend unreachable. Is the Railway service running?' },
      { status: 502 }
    )
  }

  if (backendData.error) {
    return NextResponse.json({ error: backendData.error }, { status: 400 })
  }

  // ── Persist signals to Supabase ─────────────────────────────────────────────
  const signals = backendData.signals ?? {}
  const signalRows = Object.entries(signals).map(([moduleName, sig]) => ({
    user_id:     user.id,
    ticker:      ticker.toUpperCase(),
    module_name: moduleName,
    value:       sig.value,
    confidence:  Math.min(Math.max(sig.confidence, 0), 1),
    reasoning:   sig.reasoning ?? null,
    raw_data:    sig.raw_data ?? null,
  }))

  if (signalRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertErr } = await (supabase as any)
      .from('signals')
      .insert(signalRows)
    if (insertErr) {
      console.warn('[signals] failed to persist signals:', insertErr.message)
    }
  }

  // ── Persist verdict ─────────────────────────────────────────────────────────
  if (backendData.verdict && backendData.price) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: vErr } = await (supabase as any)
      .from('verdicts')
      .insert({
        user_id:          user.id,
        ticker:           ticker.toUpperCase(),
        final_verdict:    backendData.verdict.finalVerdict,
        confidence:       Math.min(Math.max(backendData.verdict.confidence, 0), 1),
        modules_snapshot: signals,
        initial_price:    backendData.price,
      })
    if (vErr) {
      console.warn('[signals] failed to persist verdict:', vErr.message)
    }
  }

  return NextResponse.json({
    ticker:    ticker.toUpperCase(),
    signals:   backendData.signals ?? {},
    verdict:   backendData.verdict ?? null,
    price:     backendData.price   ?? null,
  })
}

// ── GET — fetch latest signals for a ticker from Supabase ────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticker = new URL(request.url).searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('signals')
    .select('*')
    .eq('user_id', user.id)
    .eq('ticker', ticker.toUpperCase())
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by module_name, keep latest per module
  const byModule: Record<string, unknown> = {}
  for (const row of (data ?? [])) {
    if (!byModule[row.module_name]) byModule[row.module_name] = row
  }

  return NextResponse.json({ ticker: ticker.toUpperCase(), signals: byModule, raw: data })
}
