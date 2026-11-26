import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { usePrivateCacheIsolation, useSession } from '@/features/auth/use-session'
import { RealtimeProvider } from '@/shared/realtime/realtime-provider'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  const { token, user, status } = useSession()
  usePrivateCacheIsolation(user?.id ?? null)

  // Wait for the session before opening the socket, so it is authenticated as the right user.
  const realtimeToken = status === 'authenticated' ? token : null
  return (
    <RealtimeProvider token={realtimeToken} userId={user?.id ?? null}>
      <Outlet />
    </RealtimeProvider>
  )
}

function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2">
        <Link to="/" className="underline">
          Back to the marketplace
        </Link>
      </p>
    </main>
  )
}
