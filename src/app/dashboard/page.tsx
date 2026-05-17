import { currentUser }                        from '@clerk/nextjs/server'
import { redirect }                           from 'next/navigation'
import { getSupabaseUserId, supabaseAdmin }   from '@/lib/auth'
import PortfolioOverviewExtended              from '@/components/dashboard/PortfolioOverviewExtended'
import WatchlistView                          from '@/components/watchlist/WatchlistView'
import TabContentRouter                       from '@/components/dashboard/TabContentRouter'

export default async function DashboardPage() {
  const clerkUser = await currentUser()
  if (!clerkUser) redirect('/auth/login')

  const supabaseUserId = await getSupabaseUserId()
  if (!supabaseUserId) redirect('/auth/login')

  // Server-side prefetch for instant first paint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: positions } = await (supabaseAdmin as any)
    .from('positions')
    .select('*')
    .eq('user_id', supabaseUserId)
    .order('added_at', { ascending: false })

  return (
    <TabContentRouter
      portfolioTab={<PortfolioOverviewExtended initialPositions={positions ?? []} />}
      watchlistTab={<WatchlistView />}
    />
  )
}
