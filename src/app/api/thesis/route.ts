import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const ticker = searchParams.get('ticker')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('thesis_log')
    .select('*')
    .eq('user_id', user.id)
    .order('version', { ascending: false })

  if (ticker) query = query.eq('ticker', ticker.toUpperCase())

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { ticker, thesis, catalysts, risks, position_id, watchlist_id } = body

  if (!ticker || !thesis) {
    return NextResponse.json({ error: 'ticker and thesis are required' }, { status: 400 })
  }

  // Get next version number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from('thesis_log')
    .select('version')
    .eq('user_id', user.id)
    .eq('ticker', ticker.toUpperCase())
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const version = existing ? (existing.version ?? 0) + 1 : 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('thesis_log')
    .insert({
      user_id:      user.id,
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
