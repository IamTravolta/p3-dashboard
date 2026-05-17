/**
 * GET /api/briefing
 *
 * Generates (or retrieves cached) a daily AI briefing for the authenticated user.
 * - Reads user's positions + watchlist from Supabase
 * - Fetches latest signals/verdicts
 * - Asks Claude to write a daily briefing
 * - Caches result for 4 hours per user
 */

import { NextResponse }   from 'next/server'
import { createClient }   from '@/lib/supabase/server'
import Anthropic          from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CACHE_HOURS = 4

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const forceRefresh = searchParams.get('refresh') === '1'

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check cache (skip on ?refresh=1)
    if (!forceRefresh) {
      const cutoff = new Date(Date.now() - CACHE_HOURS * 3600 * 1000).toISOString()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: cached } = await (supabase as any)
        .from('briefings')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', cutoff)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (cached) return NextResponse.json({ briefing: cached, cached: true })
    }

    // ── Gather portfolio context ──────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: positions } = await (supabase as any)
      .from('positions')
      .select('ticker, name, sector, current_price, avg_cost, quantity, score')
      .eq('user_id', user.id)
      .limit(20)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: watchlist } = await (supabase as any)
      .from('watchlist')
      .select('ticker, name, sector, score, conviction')
      .eq('user_id', user.id)
      .limit(10)

    // Recent verdicts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recentVerdicts } = await (supabase as any)
      .from('verdicts')
      .select('ticker, final_verdict, confidence, modules_snapshot, logged_at')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(10)

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-key-here') {
      return NextResponse.json({
        briefing: {
          content:      'Anthropic API key not configured — briefing unavailable.',
          generated_at: new Date().toISOString(),
        },
        cached: false,
      })
    }

    // ── Build prompt ─────────────────────────────────────────────────────────
    const positionSummary = (positions ?? []).map((p: {
      ticker: string; name: string; sector: string;
      current_price: number; avg_cost: number; quantity: number; score: number
    }) => {
      const pnl = ((p.current_price - p.avg_cost) / p.avg_cost * 100).toFixed(1)
      return `- ${p.ticker} (${p.sector}): ${p.quantity} shares @ €${p.avg_cost} → €${p.current_price} (${pnl}%), score ${p.score}`
    }).join('\n')

    const watchSummary = (watchlist ?? []).map((w: {
      ticker: string; name: string; sector: string; score: number; conviction: number
    }) => `- ${w.ticker} (${w.sector}), score ${w.score}, conviction ${w.conviction}/5`).join('\n')

    const verdictSummary = (recentVerdicts ?? []).map((v: {
      ticker: string; final_verdict: string; confidence: number; modules_snapshot: { reasoning?: string } | null
    }) => {
      const reasoning = v.modules_snapshot?.reasoning ?? ''
      return `- ${v.ticker}: ${v.final_verdict} (conf ${(v.confidence * 100).toFixed(0)}%)${reasoning ? ' — ' + reasoning.slice(0, 120) : ''}`
    }).join('\n')

    const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const prompt = `Write a concise daily investment briefing for ${today}.

PORTFOLIO:
${positionSummary || '(empty)'}

WATCHLIST:
${watchSummary || '(empty)'}

RECENT SIGNAL VERDICTS:
${verdictSummary || '(none)'}

Format the briefing as:
1. **Market Context** (2-3 sentences on current macro environment)
2. **Portfolio Review** (highlights, concerns, P&L observations)
3. **Watchlist Opportunities** (top 1-2 picks to consider acting on)
4. **Key Risks** (2-3 bullet points)
5. **Today's Priority** (single action sentence)

Be direct, analytical, and professional. No filler.`

    const msg = await anthropic.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 800,
      messages:   [{ role: 'user', content: prompt }],
    })

    const content = msg.content[0].type === 'text' ? msg.content[0].text : 'Briefing generation failed.'

    // ── Save to DB ────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saved } = await (supabase as any)
      .from('briefings')
      .insert({
        user_id: user.id,
        content,
      })
      .select()
      .single()

    return NextResponse.json({ briefing: saved ?? { content, created_at: new Date().toISOString() }, cached: false })
  } catch (err) {
    console.error('Briefing error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
