import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'

export async function GET() {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('paper_trades')
    .select('*')
    .eq('user_id', userId)
    .order('entry_date', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const _auth = await requireUser()
  if ('response' in _auth) return _auth.response
  const { userId, db } = _auth

  const body = await req.json()
  const { ticker, name, exchange, sector, entry_price, quantity, direction, reason, entry_date } = body

  if (!ticker || !entry_price || !quantity || !direction) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db as any)
    .from('paper_trades')
    .insert({
      user_id:     userId,
      ticker:      ticker.toUpperCase().trim(),
      name:        name ?? ticker,
      exchange:    exchange ?? 'NYSE',
      sector:      sector ?? 'Unknown',
      entry_price: parseFloat(entry_price),
      quantity:    parseInt(quantity),
      direction:   direction,  // 'LONG' | 'SHORT'
      reason:      reason ?? null,
      entry_date:  entry_date ?? new Date().toISOString(),
      status:      'OPEN',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
