/**
 * Verdict module
 *
 * Combines all signal modules (technical, polymarket, sentiment) into a
 * final BUY / SELL / HOLD verdict with confidence and detailed reasoning.
 *
 * Optionally uses Claude for narrative synthesis; falls back to rule-based
 * aggregation if ANTHROPIC_API_KEY is not set.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { TechnicalSignal }  from './technical'
import type { PolymarketSignal } from './polymarket'
import type { SentimentSignal }  from './sentiment'

export interface VerdictResult {
  verdict:    'BUY' | 'SELL' | 'HOLD'
  confidence: number   // 0–1
  reasoning:  string
  score:      number   // 0–10 composite
  signals_used: string[]
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Signal weights for composite score
const WEIGHTS = { technical: 0.40, polymarket: 0.25, sentiment: 0.35 }

function signalToNum(v: 'BULLISH' | 'BEARISH' | 'NEUTRAL'): number {
  return v === 'BULLISH' ? 1 : v === 'BEARISH' ? -1 : 0
}

/** Rule-based fallback if Claude is unavailable */
function rulesVerdict(
  tech:   TechnicalSignal,
  poly:   PolymarketSignal,
  sent:   SentimentSignal,
): VerdictResult {
  const composite =
    signalToNum(tech.value)  * WEIGHTS.technical  * tech.confidence  +
    signalToNum(poly.value)  * WEIGHTS.polymarket  * poly.confidence  +
    signalToNum(sent.value)  * WEIGHTS.sentiment   * sent.confidence

  // Map -1…+1 to 0-10
  const score = parseFloat(((composite + 1) * 5).toFixed(1))

  const verdict: VerdictResult['verdict'] =
    composite >  0.15 ? 'BUY'  :
    composite < -0.15 ? 'SELL' : 'HOLD'

  const confidence = Math.abs(composite) + 0.35

  const reasoning = [
    `Technical: ${tech.value} (conf ${(tech.confidence * 100).toFixed(0)}%). ${tech.reasoning}`,
    `Macro/Polymarket: ${poly.value} (conf ${(poly.confidence * 100).toFixed(0)}%). ${poly.reasoning}`,
    `Sentiment: ${sent.value} (conf ${(sent.confidence * 100).toFixed(0)}%). ${sent.reasoning}`,
    `Composite score: ${score}/10 → ${verdict}.`,
  ].join('\n')

  return {
    verdict,
    confidence: Math.min(0.95, confidence),
    reasoning,
    score,
    signals_used: ['technical', 'polymarket', 'sentiment'],
  }
}

export async function getVerdict(
  ticker:  string,
  name:    string,
  sector:  string,
  tech:    TechnicalSignal,
  poly:    PolymarketSignal,
  sent:    SentimentSignal,
): Promise<VerdictResult> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-key-here') {
    return rulesVerdict(tech, poly, sent)
  }

  const system = `You are a senior portfolio manager issuing actionable verdicts.
Respond ONLY with valid JSON — no markdown.
Schema:
{
  "verdict":    "BUY|SELL|HOLD",
  "confidence": 0.0–1.0,
  "score":      0.0–10.0,
  "reasoning":  "3-4 sentence synthesis"
}`

  const user = `Issue a verdict for ${name} (${ticker}), sector ${sector}.

TECHNICAL SIGNAL: ${tech.value} (confidence ${(tech.confidence * 100).toFixed(0)}%)
${tech.reasoning}

POLYMARKET SIGNAL: ${poly.value} (confidence ${(poly.confidence * 100).toFixed(0)}%)
${poly.reasoning}

SENTIMENT SIGNAL: ${sent.value} (confidence ${(sent.confidence * 100).toFixed(0)}%)
${sent.reasoning}

Weights: technical 40%, sentiment 35%, polymarket 25%.
Synthesise into a single BUY/SELL/HOLD verdict. Be decisive. Return JSON only.`

  try {
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 400,
      system,
      messages:   [{ role: 'user', content: user }],
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
      signals_used: ['technical', 'polymarket', 'sentiment'],
    }
  } catch {
    // Fall back to rules if Claude errors
    return rulesVerdict(tech, poly, sent)
  }
}
