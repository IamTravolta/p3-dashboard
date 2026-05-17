/**
 * POST /api/auth/verify
 *
 * Verifies a custom OTP code (linked email or SMS flow).
 * Looks up the challenge by email or phone, checks code + expiry,
 * marks it used, then generates a Supabase magic link for the primary
 * account and returns it so the client can redirect.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient }              from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(req: NextRequest) {
  const { sentTo, channel, code } = await req.json()

  if (!sentTo || !code) {
    return NextResponse.json({ error: 'sentTo and code are required' }, { status: 400 })
  }

  const field = channel === 'sms' ? 'phone' : 'email'

  // Look up a valid, unused challenge
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: challenge } = await (supabaseAdmin as any)
    .from('otp_challenges')
    .select('id, code, expires_at, primary_user_id, used_at')
    .eq(field, sentTo)
    .eq('channel', channel ?? 'email')
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!challenge) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 })
  }

  if (new Date(challenge.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code has expired — request a new one' }, { status: 400 })
  }

  if (challenge.code !== String(code).trim()) {
    return NextResponse.json({ error: 'Incorrect code' }, { status: 400 })
  }

  // Mark used
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('otp_challenges')
    .update({ used_at: new Date().toISOString() })
    .eq('id', challenge.id)

  // Resolve primary user email for magic link generation
  const { data: { user: primaryUser }, error: userErr } =
    await supabaseAdmin.auth.admin.getUserById(challenge.primary_user_id)

  if (userErr || !primaryUser?.email) {
    return NextResponse.json({ error: 'Could not resolve account' }, { status: 500 })
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const { data: linkData, error: linkErr } =
    await supabaseAdmin.auth.admin.generateLink({
      type:    'magiclink',
      email:   primaryUser.email,
      options: { redirectTo: `${origin}/` },
    })

  if (linkErr || !linkData?.properties?.action_link) {
    console.error('[verify] generateLink error', linkErr)
    return NextResponse.json({ error: 'Failed to generate session link' }, { status: 500 })
  }

  return NextResponse.json({ redirectTo: linkData.properties.action_link })
}
