/**
 * POST /api/auth/otp
 *
 * Smart OTP dispatcher:
 * - If the email is the user's primary Supabase auth email → send OTP directly.
 * - If the email is in user_linked_emails → look up the primary email for that
 *   account and send the OTP there instead (Supabase can only verify against the
 *   primary auth email).
 * - Returns { sentTo: string } so the client can show "code sent to X".
 *
 * Uses the service-role key to query linked emails without a session.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient }                        from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'email is required' }, { status: 400 })
  }

  const normalised = email.toLowerCase().trim()

  // ── Check if this is a linked (secondary) email ───────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linkedRow } = await (supabaseAdmin as any)
    .from('user_linked_emails')
    .select('user_id')
    .eq('email', normalised)
    .maybeSingle()

  let targetEmail = normalised

  if (linkedRow?.user_id) {
    // Resolve the primary email for this user via the admin API
    const { data: { user: adminUser }, error: adminErr } =
      await supabaseAdmin.auth.admin.getUserById(linkedRow.user_id)

    if (adminErr || !adminUser?.email) {
      return NextResponse.json({ error: 'Could not resolve account for that email' }, { status: 400 })
    }

    targetEmail = adminUser.email
  }

  // ── Send OTP to the target (primary) email ────────────────────────────────
  // We use the server client here (anon key) with shouldCreateUser: false
  // so only existing accounts receive codes.
  const supabase = await createServerClient()
  const { error } = await supabase.auth.signInWithOtp({
    email:   targetEmail,
    options: { shouldCreateUser: false },
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ sentTo: targetEmail })
}
