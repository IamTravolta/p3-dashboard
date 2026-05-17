import { NextResponse, type NextRequest } from 'next/server'
import { requireUser } from '@/lib/auth'
import type { Database } from '@/lib/types/database'

type PositionInsert = Database['public']['Tables']['positions']['Insert']
type PositionUpdate = Database['public']['Tables']['positions']['Update']

// ── GET — list all positions ─────────────────────────────────────────────────

export async function GET() {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false }) as {
      data: Database['public']['Tables']['positions']['Row'][] | null
      error: { message: string } | null
    }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// ── POST — create position ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const body = await request.json() as Omit<PositionInsert, 'user_id'>

  if (!body.ticker || !body.name) {
    return NextResponse.json({ error: 'ticker and name are required' }, { status: 400 })
  }

  const insertData: PositionInsert = {
    user_id:       userId,
    ticker:        body.ticker.toUpperCase(),
    name:          body.name,
    exchange:      body.exchange      ?? 'NYSE',
    sector:        body.sector        ?? 'Unknown',
    sub_industry:  body.sub_industry  ?? null,
    shares:        body.shares        ?? 0,
    avg_buy_price: body.avg_buy_price ?? 0,
    current_price: body.current_price ?? 0,
    currency:      body.currency      ?? 'USD',
    factor_scores: body.factor_scores ?? { q: 0, g: 0, v: 0, m: 0, s: 0 },
    conviction:    body.conviction    ?? 3,
    thesis:        body.thesis        ?? null,
    notes:         body.notes         ?? null,
    added_at:      body.added_at      ?? new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('positions')
    .insert(insertData)
    .select()
    .single() as {
      data: Database['public']['Tables']['positions']['Row'] | null
      error: { message: string } | null
    }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
