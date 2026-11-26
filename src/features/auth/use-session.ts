import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { queryKeys } from '@/shared/api/query-keys'
import { onSessionExpired, sessionStore } from '@/shared/session/session-store'
import { authApi } from './api'

export function useSessionToken() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getToken, sessionStore.getToken)
}

/** Current session, recovered from `GET /session` (so it survives refresh). */
export function useSession() {
  const token = useSessionToken()
  const query = useQuery({
    queryKey: queryKeys.session(token),
    queryFn: ({ signal }) => authApi.getSession({ signal }),
    enabled: token !== null,
    staleTime: 5 * 60_000,
  })
  return {
    token,
    user: token ? (query.data?.user ?? null) : null,
    status: token === null ? ('anonymous' as const) : query.isPending ? ('loading' as const) : query.isError ? ('error' as const) : ('authenticated' as const),
  }
}

/**
 * Drops private cached data whenever the session ends or changes (logout, expiry, user switch),
 * so data of a previous user can never be rendered for the next one.
 */
export function usePrivateCacheIsolation(userId: string | null) {
  const queryClient = useQueryClient()
  const previous = useRef(userId)

  useEffect(() => {
    if (previous.current !== userId) {
      if (previous.current) queryClient.removeQueries({ queryKey: queryKeys.user.all(previous.current) })
      queryClient.removeQueries({ queryKey: queryKeys.cart.all() })
      previous.current = userId
    }
  }, [queryClient, userId])

  useEffect(
    () =>
      onSessionExpired(() => {
        queryClient.removeQueries({ queryKey: ['user'] })
        queryClient.removeQueries({ queryKey: queryKeys.cart.all() })
      }),
    [queryClient],
  )
}
