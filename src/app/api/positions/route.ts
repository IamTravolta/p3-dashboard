import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/database'

type PositionInsert = Database['public']['Tables']['positions']['Insert']
type PositionUpdate = Database['public']['Tables']['positions']['Update']

// ── GET — list all positions ─────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('positions')
    .select('*')
    .eq('user_id', user.id)
    .order('added_at', { ascending: false }) as {
      data: Database['public']['Tables']['positions']['Row'][] | null
      error: { message: string } | null
    }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// ── POST — create position ───────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Omit<PositionInsert, 'user_id'>

  if (!body.ticker || !body.name) {
    return NextResponse.json({ error: 'ticker and name are required' }, { status: 400 })
  }

  const insertData: PositionInsert = {
    user_id:       user.id,
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
  const { data, error } = await (supabase as any)
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
