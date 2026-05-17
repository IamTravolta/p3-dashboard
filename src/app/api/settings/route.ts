/**
 * GET  /api/settings  — fetch user settings
 * POST /api/settings  — upsert user settings
 *
 * Settings are stored in Supabase user_metadata, accessed via the admin API.
 */
import { NextRequest, NextResponse }    from 'next/server'
import { requireUser, supabaseAdmin }   from '@/lib/auth'

export interface UserSettings {
  currency:         string
  factor_weights: {
    q: number
    g: number
    v: number
    m: number
    s: number
  }
  max_position_pct: number
  briefing_hour:    number
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
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId } = _auth

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
  const stored = (user?.user_metadata?.settings ?? {}) as Partial<UserSettings>
  const settings = {
    ...DEFAULT_SETTINGS,
    ...stored,
    factor_weights: { ...DEFAULT_SETTINGS.factor_weights, ...(stored.factor_weights ?? {}) },
  }

  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId } = _auth

  const body = await req.json() as Partial<UserSettings>

  const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)
  const existing = (user?.user_metadata?.settings ?? {}) as Partial<UserSettings>

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

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { settings: merged },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: merged })
}
