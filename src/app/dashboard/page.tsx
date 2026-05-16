import { createClient } from '@/lib/supabase/server'
import PortfolioOverview from '@/components/dashboard/PortfolioOverview'
import WatchlistView from '@/components/watchlist/WatchlistView'
import TabContent from '@/components/dashboard/TabContent'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Server-side prefetch for instant first paint (no loading flash)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [{ data: positions }, { data: watchlist }] = await Promise.all([
    (supabase as any).from('positions').select('*').eq('user_id', user!.id).order('added_at', { ascending: false }),
    (supabase as any).from('watchlist').select('*').eq('user_id', user!.id).order('added_at', { ascending: false }),
  ])

  return (
    <>
      <PortfolioOverview initialPositions={positions ?? []} />
      <WatchlistView />
      <TabContent />
    </>
  )
}
