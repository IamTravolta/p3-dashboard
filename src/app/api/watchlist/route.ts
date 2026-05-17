import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import type { Database } from '@/lib/types/database'

type WatchlistInsert = Database['public']['Tables']['watchlist']['Insert']

export async function GET() {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('watchlist')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false }) as {
      data: Database['public']['Tables']['watchlist']['Row'][] | null
      error: { message: string } | null
    }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(request: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const body = await request.json() as Omit<WatchlistInsert, 'user_id'>

  if (!body.ticker || !body.name) {
    return NextResponse.json({ error: 'ticker and name are required' }, { status: 400 })
  }

  const insertData: WatchlistInsert = {
    user_id:       userId,
    ticker:        body.ticker.toUpperCase(),
    name:          body.name,
    exchange:      body.exchange      ?? 'NYSE',
    sector:        body.sector        ?? 'Unknown',
    sub_industry:  body.sub_industry  ?? null,
    current_price: body.current_price ?? 0,
    score:         body.score         ?? 0,
    factor_scores: body.factor_scores ?? { q: 0, g: 0, v: 0, m: 0, s: 0 },
    reason:        body.reason        ?? null,
    price_trigger: body.price_trigger ?? null,
    score_trigger: body.score_trigger ?? null,
    conviction:    body.conviction    ?? 3,
    expiry_date:   body.expiry_date   ?? null,
    added_at:      body.added_at      ?? new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('watchlist')
    .insert(insertData)
    .select()
    .single() as {
      data: Database['public']['Tables']['watchlist']['Row'] | null
      error: { message: string } | null
    }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
