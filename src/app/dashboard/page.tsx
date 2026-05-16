import { createClient }       from '@/lib/supabase/server'
import PortfolioOverview     from '@/components/dashboard/PortfolioOverview'
import WatchlistView         from '@/components/watchlist/WatchlistView'
import TabContentRouter      from '@/components/dashboard/TabContentRouter'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Server-side prefetch for instant first paint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: positions }, { data: watchlist }] = await Promise.all([
    (supabase as any).from('positions').select('*').eq('user_id', user!.id).order('added_at', { ascending: false }),
    (supabase as any).from('watchlist').select('*').eq('user_id', user!.id).order('added_at', { ascending: false }),
  ])

  // Unused watchlist prefetch kept for potential future use
  void watchlist

  return (
    <TabContentRouter
      portfolioTab={<PortfolioOverview initialPositions={positions ?? []} />}
      watchlistTab={<WatchlistView />}
    />
  )
}
