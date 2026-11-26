import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { useOrderNotices } from '@/features/orders/use-order-notices'
import { queryKeys } from '@/shared/api/query-keys'
import { notify } from '@/shared/feedback/notifications'
import { RealtimeProvider } from '@/shared/realtime/realtime-provider'
import { Toaster } from '@/shared/ui/sonner'
import { onSessionExpired, sessionStore } from '@/shared/session/session-store'
import { clearPrivateData, useSession } from './session'

/**
 * Session lifecycle for the whole app (rendered once, in the root layout):
 * - recovers the session after a refresh (`GET /session`);
 * - one Socket.IO connection per session: authenticated as the current user, recreated on
 *   login/user switch and downgraded to a visitor socket on logout/expiry;
 * - on expiry (401 from REST or socket handshake rejected): private cache dropped, user sent
 *   to `/login?redirect=<current location>` when on a private route (checkout state is
 *   persisted per user, so the flow resumes after logging in again);
 * - announces payment results (`order.updated`).
 * - renders the toasts (`<Toaster />` of shared/ui/sonner, an `aria-live` region).
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { token, user, status } = useSession()
  const userId = user?.id ?? null
  const queryClient = useQueryClient()
  const router = useRouter()

  // Defense in depth: whenever the user changes, nothing keyed by the previous one survives.
  const previousUserId = useRef(userId)
  useEffect(() => {
    const previous = previousUserId.current
    if (previous && previous !== userId) {
      queryClient.removeQueries({ queryKey: queryKeys.user.all(previous) })
      queryClient.removeQueries({ queryKey: queryKeys.cart.detail({ userId: previous }) })
    }
    previousUserId.current = userId
  }, [queryClient, userId])

  // Several in-flight requests may fail with 401 at once: handle the expiry once per session.
  const expiryHandled = useRef(false)
  useEffect(() => {
    if (token) expiryHandled.current = false
  }, [token])

  useEffect(
    () =>
      onSessionExpired(() => {
        if (expiryHandled.current) return
        expiryHandled.current = true
        sessionStore.setToken(null)
        clearPrivateData(queryClient)
        notify({ tone: 'warning', title: 'Sua sessão expirou.', description: 'Entre novamente para continuar.', key: 'session-expired' })

        const { location, matches } = router.state
        const onPrivateRoute = matches.some((match) => match.routeId.startsWith('/_authenticated'))
        if (onPrivateRoute) {
          void router.navigate({ to: '/login', search: { redirect: location.href, reason: 'expired' }, replace: true })
        } else {
          // Public screens keep working as a visitor: refetch what failed with the stale token.
          void queryClient.invalidateQueries()
        }
      }),
    [queryClient, router],
  )

  useOrderNotices()

  // Wait for the session before opening the socket, so it is authenticated as the right user.
  const realtimeToken = status === 'authenticated' ? token : null
  return (
    <RealtimeProvider token={realtimeToken} userId={status === 'authenticated' ? userId : null}>
      {children}
      <Toaster />
    </RealtimeProvider>
  )
}
