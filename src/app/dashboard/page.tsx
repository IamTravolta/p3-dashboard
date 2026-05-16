import { createClient } from '@/lib/supabase/server'
import PortfolioOverview from '@/components/dashboard/PortfolioOverview'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch positions server-side for initial render (avoids flash)
  const { data: positions } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', user!.id)
    .order('added_at', { ascending: false })

  return <PortfolioOverview initialPositions={positions ?? []} />
}
