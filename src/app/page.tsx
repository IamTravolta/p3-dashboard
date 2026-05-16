import { redirect } from 'next/navigation'

// Root redirects to dashboard; middleware handles the auth guard
export default function RootPage() {
  redirect('/dashboard')
}
