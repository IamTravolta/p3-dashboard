import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { type NextRequest, NextFetchEvent }    from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/auth(.*)',
  '/api/auth(.*)',
])

const clerkHandler = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export async function proxy(request: NextRequest) {
  const event = { waitUntil: () => {}, passThroughOnException: () => {} } as NextFetchEvent
  return clerkHandler(request, event)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
