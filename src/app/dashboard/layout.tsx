import { currentUser }          from '@clerk/nextjs/server'
import { redirect }             from 'next/navigation'
import { getSupabaseUserId }    from '@/lib/auth'
import DashboardShell           from '@/components/dashboard/DashboardShell'

export const metadata = {
  title:       'P3 Dashboard',
  description: 'Personal Portfolio & Prediction Platform',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const clerkUser = await currentUser()
  if (!clerkUser) redirect('/auth/login')

  const supabaseUserId = await getSupabaseUserId()
  if (!supabaseUserId) redirect('/auth/login')

  const user = {
    id:    supabaseUserId,
    email: clerkUser.emailAddresses?.[0]?.emailAddress ?? '',
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
