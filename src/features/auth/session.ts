import { queryOptions, useQuery, type QueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import type { Session, User } from '@/contracts'
import { queryKeys } from '@/shared/api/query-keys'
import { clearNotices } from '@/shared/feedback/notifications'
import { sessionStore } from '@/shared/session/session-store'
import { userStorage } from '@/shared/session/user-storage'
import { authApi } from './api'

/** `GET /session` keyed by token: a new login never reads the previous user's session. */
export function sessionQueryOptions(token: string) {
  return queryOptions({
    queryKey: queryKeys.session(token),
    queryFn: ({ signal }) => authApi.getSession({ signal }),
    staleTime: 5 * 60_000,
  })
}

export function useSessionToken() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getToken, sessionStore.getToken)
}

export function useGuestCartId() {
  return useSyncExternalStore(sessionStore.subscribe, sessionStore.getGuestCartId, sessionStore.getGuestCartId)
}

export type SessionStatus = 'anonymous' | 'loading' | 'authenticated' | 'error'

export interface SessionState {
  token: string | null
  user: User | null
  /** `loading` while `GET /session` validates a stored token (e.g. right after a refresh). */
  status: SessionStatus
  isAuthenticated: boolean
  /** Failure of `GET /session` after the automatic retries (network, timeout, 5xx); 401 ends the session instead. */
  error: unknown
  /** Asks `GET /session` again (status `error`); `retrying` while it runs. */
  retry: () => void
  retrying: boolean
}

/** Current session, recovered from `GET /session` (so it survives refresh). */
export function useSession(): SessionState {
  const token = useSessionToken()
  const query = useQuery({ ...sessionQueryOptions(token ?? ''), enabled: token !== null })
  const user = token ? (query.data?.user ?? null) : null
  const status: SessionStatus =
    token === null ? 'anonymous' : query.data ? 'authenticated' : query.isError ? 'error' : 'loading'
  const { refetch } = query
  const retry = useCallback(() => void refetch(), [refetch])
  return {
    token,
    user,
    status,
    isAuthenticated: status === 'authenticated',
    error: status === 'error' ? query.error : null,
    retry,
    retrying: status === 'error' && query.isFetching,
  }
}

export function useCurrentUser(): User | null {
  return useSession().user
}

/**
 * Drops everything private from the client: query cache of users and carts, sessions,
 * pending mutations and visible notices. Public catalog data is kept.
 */
export function clearPrivateData(queryClient: QueryClient) {
  for (const queryKey of [['user'], queryKeys.cart.all(), ['session'], ['checkout']]) {
    void queryClient.cancelQueries({ queryKey })
    queryClient.removeQueries({ queryKey })
  }
  queryClient.getMutationCache().clear()
  clearNotices()
}

/**
 * Login/register succeeded. Whatever the previous session was (another user, or the same
 * one after expiry) its cached data goes away before the new token is published; the
 * visitor cart was merged server-side, so a new visitor id is used from now on.
 */
export function startSession(queryClient: QueryClient, session: Session) {
  clearPrivateData(queryClient)
  userStorage.clearOthers(session.user.id)
  sessionStore.rotateGuestCartId()
  queryClient.setQueryData(queryKeys.session(session.token), { expiresAt: session.expiresAt, user: session.user })
  sessionStore.setToken(session.token)
}

/** Logout: token, private cache, per-user storage and visitor cart are all discarded. */
export function endSession(queryClient: QueryClient) {
  sessionStore.setToken(null)
  sessionStore.rotateGuestCartId()
  clearPrivateData(queryClient)
  userStorage.clearOthers(null)
}
