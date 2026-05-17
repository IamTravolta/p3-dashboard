/**
 * Verdict module
 *
 * Combines signal modules (technical, polymarket, sentiment) PLUS
 * external context (fundamentals, macro regime, insider transactions)
 * into a final BUY / SELL / HOLD verdict with confidence and reasoning.
 *
 * Falls back to rule-based aggregation if ANTHROPIC_API_KEY is not set.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TechnicalSignal }   from './technical'
import type { PolymarketSignal }  from './polymarket'
import type { SentimentSignal }   from './sentiment'
import type { FundamentalsBundle } from '@/lib/utils/fmp'
import type { MacroSnapshot }      from '@/lib/utils/fred'
import type { InsiderSummary }     from '@/lib/utils/edgar'

export interface VerdictResult {
  verdict:      'BUY' | 'SELL' | 'HOLD'
  confidence:   number   // 0–1
  reasoning:    string
  score:        number   // 0–10 composite
  signals_used: string[]
  earningsWarning: boolean   // true if earnings < 14 days away
  macroRegime:  string
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const WEIGHTS = { technical: 0.40, polymarket: 0.25, sentiment: 0.35 }

function signalToNum(v: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): number {
  return v === 'BULLISH' ? 1 : v === 'BEARISH' ? -1 : 0
}

function rulesVerdict(
  tech:  TechnicalSignal,
  poly:  PolymarketSignal,
  sent:  SentimentSignal,
  macro?: MacroSnapshot | null,
): Pick<VerdictResult, 'verdict' | 'confidence' | 'reasoning' | 'score' | 'signals_used'> {
  let composite =
    signalToNum(tech.value)  * WEIGHTS.technical  * tech.confidence  +
    signalToNum(poly.value)  * WEIGHTS.polymarket  * poly.confidence  +
    signalToNum(sent.value)  * WEIGHTS.sentiment   * sent.confidence

  // Dampen signals in risk-off / crisis macro regimes
  if (macro?.regime === 'risk-off') composite *= 0.7
  if (macro?.regime === 'crisis')   composite *= 0.4

  const score   = parseFloat(((composite + 1) * 5).toFixed(1))
  const verdict: VerdictResult['verdict'] =
    composite >  0.15 ? 'BUY'  :
    composite < -0.15 ? 'SELL' : 'HOLD'
  const confidence = Math.min(0.95, Math.abs(composite) + 0.35)

  const reasoning = [
    `Technical: ${tech.value} (conf ${(tech.confidence * 100).toFixed(0)}%). ${tech.reasoning}`,
    `Macro/Polymarket: ${poly.value} (conf ${(poly.confidence * 100).toFixed(0)}%). ${poly.reasoning}`,
    `Sentiment: ${sent.value} (conf ${(sent.confidence * 100).toFixed(0)}%). ${sent.reasoning}`,
    macro ? `Macro regime: ${macro.regime} — ${macro.regimeSummary}` : '',
    `Composite score: ${score}/10 → ${verdict}.`,
  ].filter(Boolean).join('\n')

  return { verdict, confidence, reasoning, score, signals_used: ['technical', 'polymarket', 'sentiment'] }
}

// ── Build the enriched context block for Claude ───────────────────────────────

function buildContextBlock(
  fundamentals?: FundamentalsBundle | null,
  macro?:        MacroSnapshot      | null,
  insider?:      InsiderSummary     | null,
): string {
  const lines: string[] = []

  // Macro
  if (macro) {
    lines.push(`\nMACRO REGIME: ${macro.regime.toUpperCase()}`)
    lines.push(macro.regimeSummary)
    if (macro.vix)          lines.push(`  VIX: ${macro.vix.toFixed(1)}`)
    if (macro.yieldSpread !== null) lines.push(`  Yield curve (10y-2y): ${macro.yieldSpread >= 0 ? '+' : ''}${macro.yieldSpread.toFixed(2)}%${macro.yieldSpread < 0 ? ' ⚠ inverted' : ''}`)
    if (macro.creditSpread) lines.push(`  HY credit spread: ${macro.creditSpread.toFixed(2)}%`)
  }

  // Fundamentals
  if (fundamentals) {
    lines.push('\nFUNDAMENTALS:')
    if (fundamentals.peRatio !== null)
      lines.push(`  P/E ratio: ${fundamentals.peRatio.toFixed(1)}×`)
    if (fundamentals.evToEbitda !== null)
      lines.push(`  EV/EBITDA: ${fundamentals.evToEbitda.toFixed(1)}×`)
    if (fundamentals.revenueGrowthYoY !== null)
      lines.push(`  Revenue growth YoY: ${(fundamentals.revenueGrowthYoY * 100).toFixed(1)}%`)
    if (fundamentals.netMargin !== null)
      lines.push(`  Net margin: ${(fundamentals.netMargin * 100).toFixed(1)}%`)
    if (fundamentals.debtToEquity !== null)
      lines.push(`  Debt/Equity: ${fundamentals.debtToEquity.toFixed(2)}`)
    if (fundamentals.analystConsensus)
      lines.push(`  Analyst consensus: ${fundamentals.analystConsensus}${fundamentals.analystTarget ? ` | Price target: $${fundamentals.analystTarget.toFixed(2)}` : ''}`)
    if (fundamentals.estimateRevisions)
      lines.push(`  Estimate revisions: ${fundamentals.estimateRevisions.toUpperCase()} (earnings estimates trending ${fundamentals.estimateRevisions})`)

    // Earnings
    if (fundamentals.earningsDate) {
      const d = fundamentals.daysToEarnings
      const urgency = d !== null && d <= 7 ? ' ⚠ VERY SOON' : d !== null && d <= 14 ? ' ⚠ APPROACHING' : ''
      lines.push(`\nEARNINGS: Next report in ${d ?? '?'} days (${fundamentals.earningsDate})${urgency}`)
      if (fundamentals.earningsTime)
        lines.push(`  Reporting time: ${fundamentals.earningsTime === 'amc' ? 'After market close' : fundamentals.earningsTime === 'bmo' ? 'Before market open' : 'During hours'}`)
    }

    // Surprise history
    if (fundamentals.surpriseHistory.length > 0) {
      const history = fundamentals.surpriseHistory
        .map((s) => `${s.date.slice(0, 7)}: ${s.beat ? `BEAT +${s.epsMiss.toFixed(2)}` : `MISS ${s.epsMiss.toFixed(2)}`}`)
        .join(' | ')
      lines.push(`  Last ${fundamentals.surpriseHistory.length}Q earnings: ${history}`)
    }
  }

  // Insider
  if (insider && insider.transactions.length > 0) {
    lines.push(`\nINSIDER ACTIVITY (90 days): ${insider.netBuySignal.toUpperCase()}`)
    lines.push(`  ${insider.summary}`)
    const topTxns = insider.transactions.slice(0, 3)
    for (const t of topTxns) {
      const val = t.totalValue ? ` ($${(t.totalValue / 1000).toFixed(0)}k)` : ''
      lines.push(`  ${t.filedAt} — ${t.insiderName} (${t.insiderTitle || 'Insider'}): ${t.transactionType.toUpperCase()} ${t.shares.toLocaleString()} shares${val}`)
    }
  } else if (insider) {
    lines.push(`\nINSIDER ACTIVITY: ${insider.summary}`)
  }

  return lines.join('\n')
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getVerdict(
  ticker:        string,
  name:          string,
  sector:        string,
  tech:          TechnicalSignal,
  poly:          PolymarketSignal,
  sent:          SentimentSignal,
  fundamentals?: FundamentalsBundle | null,
  macro?:        MacroSnapshot      | null,
  insider?:      InsiderSummary     | null,
): Promise<VerdictResult> {
  const earningsWarning = (fundamentals?.daysToEarnings ?? 999) <= 14
  const macroRegime     = macro?.regime ?? 'unknown'

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-key-here') {
    const base = rulesVerdict(tech, poly, sent, macro)
    return { ...base, earningsWarning, macroRegime }
  }

  const contextBlock = buildContextBlock(fundamentals, macro, insider)

  const system = `You are a senior portfolio manager issuing actionable investment verdicts.
You have access to technical signals, fundamental data, macro context, and insider transaction data.
Respond ONLY with valid JSON — no markdown, no explanation outside the JSON.
Schema:
{
  "verdict":    "BUY|SELL|HOLD",
  "confidence": 0.0–1.0,
  "score":      0.0–10.0,
  "reasoning":  "4-6 sentence synthesis covering technicals, fundamentals, macro, and any key risks"
}

Key rules:
- If earnings are within 7 days, reduce confidence by 0.10–0.20 and note binary risk
- If macro regime is risk-off or crisis, be more conservative — prefer HOLD over BUY
- Insider buying by executives (open-market purchases) is a meaningful positive signal
- Insider selling is less informative (often pre-planned), weight it lightly
- Estimate revisions UP are bullish, DOWN are bearish
- An inverted yield curve increases recession probability — factor this in`

  const userPrompt = `Issue a verdict for ${name} (${ticker}), sector: ${sector}.

TECHNICAL SIGNAL: ${tech.value} (confidence ${(tech.confidence * 100).toFixed(0)}%)
${tech.reasoning}

POLYMARKET/MACRO SIGNAL: ${poly.value} (confidence ${(poly.confidence * 100).toFixed(0)}%)
${poly.reasoning}

SENTIMENT SIGNAL: ${sent.value} (confidence ${(sent.confidence * 100).toFixed(0)}%)
${sent.reasoning}

Signal weights: technical 40%, sentiment 35%, polymarket 25%.
${contextBlock}

Synthesise ALL available context into a single BUY/SELL/HOLD verdict. Be decisive. Return JSON only.`

  try {
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 600,
      system,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const text   = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text) as {
      verdict:    string
      confidence: number
      score:      number
      reasoning:  string
    }

    const verdict = (['BUY', 'SELL', 'HOLD'].includes(parsed.verdict?.toUpperCase())
      ? parsed.verdict.toUpperCase()
      : 'HOLD') as VerdictResult['verdict']

    return {
      verdict,
      confidence:   Math.min(0.95, Math.max(0, parsed.confidence ?? 0.50)),
      score:        Math.min(10,   Math.max(0, parsed.score      ?? 5)),
      reasoning:    parsed.reasoning ?? 'No reasoning returned.',
      signals_used: ['technical', 'polymarket', 'sentiment', 'fundamentals', 'macro', 'insider'],
      earningsWarning,
      macroRegime,
    }
  } catch {
    const base = rulesVerdict(tech, poly, sent, macro)
    return { ...base, earningsWarning, macroRegime }
  }
}
