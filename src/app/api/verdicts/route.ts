/**
 * GET /api/verdicts
 *
 * Returns all verdicts for the current user, most recent first.
 * Used by ClaudeLogView to display the full verdict history.
 */

import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  try {
    const _auth = await requireUser()
    if ('response' in _auth) return _auth.response
    const { userId, db } = _auth

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
      .from('verdicts')
      .select('id, ticker, verdict, score, confidence, reasoning, logged_at')
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    console.error('[verdicts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
