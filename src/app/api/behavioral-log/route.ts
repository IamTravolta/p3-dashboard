import { requireUser }                from '@/lib/auth'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database }             from '@/lib/types/database'

type BehavioralLogInsert = Database['public']['Tables']['behavioral_log']['Insert']

export async function POST(request: NextRequest) {
  try {
    const _auth = await requireUser()
    if ('response' in _auth) return _auth.response
    const { userId, db } = _auth

    const body = await request.json() as Omit<BehavioralLogInsert, 'user_id'>

    if (!body.action_type || !body.user_action) {
      return NextResponse.json(
        { error: 'action_type and user_action are required' },
        { status: 400 },
      )
    }

    const insertData: BehavioralLogInsert = {
      user_id:               userId,
      action_type:           body.action_type,
      ticker:                body.ticker ?? null,
      system_recommendation: body.system_recommendation ?? null,
      user_action:           body.user_action,
      followed_advice:       body.followed_advice ?? null,
      context:               body.context ?? null,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = db.from('behavioral_log') as any
    const { data, error } = await q
      .insert(insertData)
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null }

    if (error) {
      console.error('[behavioral-log] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ id: data?.id ?? null }, { status: 201 })
  } catch (err) {
    console.error('[behavioral-log] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const _auth = await requireUser()
    if ('response' in _auth) return _auth.response
    const { userId, db } = _auth

    const { searchParams } = new URL(request.url)
    const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50'),  200)
    const offset = parseInt(searchParams.get('offset') ?? '0')
    const ticker = searchParams.get('ticker')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (db as any)
      .from('behavioral_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (ticker) query = query.eq('ticker', ticker)

    const { data, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, count: data?.length ?? 0 })
  } catch (err) {
    console.error('[behavioral-log] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
