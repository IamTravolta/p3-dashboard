/**
 * Shared auth helper for API routes.
 * Verifies Clerk session, resolves the corresponding Supabase user ID,
 * and returns an admin Supabase client ready for DB queries.
 */
import { auth, currentUser } from '@clerk/nextjs/server'
import { createClient }      from '@supabase/supabase-js'
import { NextResponse }      from 'next/server'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

// Module-level cache: clerkUserId → supabaseUserId (persists across requests)
const _cache = new Map<string, string>()

export async function getSupabaseUserId(): Promise<string | null> {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return null

  if (_cache.has(clerkUserId)) return _cache.get(clerkUserId)!

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses?.[0]?.emailAddress
  if (!email) return null

  // Find the matching Supabase auth user by email
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error || !data) return null

  // 1. Check primary Supabase account email
  const supabaseUser = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  )
  if (supabaseUser) {
    _cache.set(clerkUserId, supabaseUser.id)
    return supabaseUser.id
  }

  // 2. Check registered linked emails — returns the owner's Supabase user ID
  const { data: linked } = await supabaseAdmin
    .from('user_linked_emails')
    .select('user_id')
    .eq('email', email.toLowerCase())
    .limit(1)
    .single()

  if (linked?.user_id) {
    _cache.set(clerkUserId, linked.user_id)
    return linked.user_id
  }

  // 3. Email not authorised — deny access
  return null
}

type AuthOk  = { userId: string; db: typeof supabaseAdmin }
type AuthFail = { response: NextResponse }

export async function requireUser(): Promise<AuthOk | AuthFail> {
  const userId = await getSupabaseUserId()
  if (!userId) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  return { userId, db: supabaseAdmin }
}
