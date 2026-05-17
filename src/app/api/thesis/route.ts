import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (db as any)
    .from('thesis_log')
    .select('*')
    .eq('user_id', userId)
    .order('version', { ascending: false })

  if (ticker) query = query.eq('ticker', ticker.toUpperCase())

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const body = await req.json()
  const { ticker, thesis, catalysts, risks, position_id, watchlist_id } = body

  if (!ticker || !thesis) {
    return NextResponse.json({ error: 'ticker and thesis are required' }, { status: 400 })
  }

  // Get next version number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (db as any)
    .from('thesis_log')
    .select('version')
    .eq('user_id', userId)
    .eq('ticker', ticker.toUpperCase())
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const version = existing ? (existing.version ?? 0) + 1 : 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('thesis_log')
    .insert({
      user_id:      userId,
      ticker:       ticker.toUpperCase().trim(),
      thesis,
      catalysts:    catalysts ?? null,
      risks:        risks ?? null,
      version,
      position_id:  position_id  ?? null,
      watchlist_id: watchlist_id ?? null,
      created_at:   new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
