/**
 * GET  /api/settings  — fetch user settings (from user_metadata or settings table)
 * POST /api/settings  — upsert user settings
 *
 * We store settings in Supabase user_metadata for simplicity.
 * Falls back to a sensible default if not yet set.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export interface UserSettings {
  currency:         string   // 'EUR' | 'USD' | 'GBP'
  factor_weights: {
    q: number   // Quality    0-1, sum should be 1
    g: number   // Growth
    v: number   // Valuation
    m: number   // Momentum
    s: number   // Sentiment
  }
  max_position_pct: number   // e.g. 0.15 = 15% per position
  briefing_hour:    number   // 0-23, local hour to gen daily briefing
  theme:            'dark' | 'light'
}

const DEFAULT_SETTINGS: UserSettings = {
  currency:         'EUR',
  factor_weights:   { q: 0.25, g: 0.25, v: 0.20, m: 0.15, s: 0.15 },
  max_position_pct: 0.15,
  briefing_hour:    8,
  theme:            'dark',
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const stored = (user.user_metadata?.settings ?? {}) as Partial<UserSettings>
  const settings = { ...DEFAULT_SETTINGS, ...stored, factor_weights: { ...DEFAULT_SETTINGS.factor_weights, ...(stored.factor_weights ?? {}) } }

  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as Partial<UserSettings>

  // Merge with existing
  const existing = (user.user_metadata?.settings ?? {}) as Partial<UserSettings>
  const merged: UserSettings = {
    ...DEFAULT_SETTINGS,
    ...existing,
    ...body,
    factor_weights: {
      ...DEFAULT_SETTINGS.factor_weights,
      ...(existing.factor_weights ?? {}),
      ...(body.factor_weights ?? {}),
    },
  }

  const { error } = await supabase.auth.updateUser({
    data: { settings: merged }
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: merged })
}
