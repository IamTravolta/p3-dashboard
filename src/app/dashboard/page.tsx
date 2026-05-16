import { createClient }              from '@/lib/supabase/server'
import PortfolioOverviewExtended     from '@/components/dashboard/PortfolioOverviewExtended'
import WatchlistView                 from '@/components/watchlist/WatchlistView'
import TabContentRouter              from '@/components/dashboard/TabContentRouter'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Server-side prefetch for instant first paint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: positions }] = await Promise.all([
    (supabase as any).from('positions').select('*').eq('user_id', user!.id).order('added_at', { ascending: false }),
  ])

  return (
    <TabContentRouter
      portfolioTab={<PortfolioOverviewExtended initialPositions={positions ?? []} />}
      watchlistTab={<WatchlistView />}
    />
  )
}
