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
import { requireUser } from '@/lib/auth'
import { getMacroSnapshot }  from '@/lib/utils/fred'

export async function GET() {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const snapshot = await getMacroSnapshot()
  return NextResponse.json(snapshot)
}
