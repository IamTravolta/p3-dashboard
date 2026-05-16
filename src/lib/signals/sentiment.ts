/**
 * Sentiment signal module
 *
 * Uses Claude (Anthropic) to analyse:
 * - Sector macro sentiment
 * - News / narrative context
 * - Management quality / moat signals (from ticker + sector)
 *
 * Returns BULLISH / BEARISH / NEUTRAL with confidence + reasoning.
 */

import Anthropic from '@anthropic-ai/sdk'

export interface SentimentSignal {
  value:      'BULLISH' | 'BEARISH' | 'NEUTRAL'
  confidence: number
  reasoning:  string
  raw_data: {
    sector_sentiment:    string
    narrative_sentiment: string
    overall:             string
  }
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function getSentimentSignal(
  ticker:   string,
  sector:   string,
  name:     string,
  reason?:  string   // user's own thesis note
): Promise<SentimentSignal> {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your-anthropic-key-here') {
    return {
      value:      'NEUTRAL',
      confidence: 0.25,
      reasoning:  'Anthropic API key not configured — sentiment signal skipped.',
      raw_data:   { sector_sentiment: 'unknown', narrative_sentiment: 'unknown', overall: 'neutral' },
    }
  }

  const systemPrompt = `You are a quantitative equity analyst producing structured sentiment assessments.
Respond ONLY with valid JSON — no markdown, no prose outside the JSON.
Schema:
{
  "sector_sentiment":    "bullish|bearish|neutral",
  "narrative_sentiment": "bullish|bearish|neutral",
  "overall":             "BULLISH|BEARISH|NEUTRAL",
  "confidence":          0.0–1.0,
  "reasoning":           "2-3 sentence explanation"
}`

  const userPrompt = `Assess sentiment for ${name} (${ticker}), sector: ${sector}.
${reason ? `Analyst thesis: "${reason}"` : ''}
Consider: current sector macro environment, typical moat / competitive position for this sector, broader equity market conditions in mid-2025.
Return JSON only.`

  try {
    const msg = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 300,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const parsed = JSON.parse(text) as {
      sector_sentiment:    string
      narrative_sentiment: string
      overall:             string
      confidence:          number
      reasoning:           string
    }

    const value = (['BULLISH', 'BEARISH', 'NEUTRAL'].includes(parsed.overall.toUpperCase())
      ? parsed.overall.toUpperCase()
      : 'NEUTRAL') as SentimentSignal['value']

    return {
      value,
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.40)),
      reasoning:  parsed.reasoning ?? 'No reasoning returned.',
      raw_data: {
        sector_sentiment:    parsed.sector_sentiment    ?? 'neutral',
        narrative_sentiment: parsed.narrative_sentiment ?? 'neutral',
        overall:             parsed.overall             ?? 'NEUTRAL',
      },
    }
  } catch {
    return {
      value:      'NEUTRAL',
      confidence: 0.25,
      reasoning:  'Sentiment analysis failed — API error or parse error.',
      raw_data:   { sector_sentiment: 'unknown', narrative_sentiment: 'unknown', overall: 'NEUTRAL' },
    }
  }
}
