/**
 * GET /api/macro
 *
 * Returns the current macro regime snapshot:
 * - VIX level
 * - Yield curve (10y - 2y spread)
 * - HY credit spread
 * - Fed funds rate
 * - Regime label: risk-on | cautious | risk-off | crisis
 * - Human-readable regime summary for injection into verdicts
 *
 * Data sourced from FRED. Cached 4 hours.
 */

import { NextResponse }      from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { getMacroSnapshot }  from '@/lib/utils/fred'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const snapshot = await getMacroSnapshot()
  return NextResponse.json(snapshot)
}
