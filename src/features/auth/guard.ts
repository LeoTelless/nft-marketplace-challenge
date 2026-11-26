import { isCancelledError, type QueryClient } from '@tanstack/react-query'
import { redirect, type ParsedLocation } from '@tanstack/react-router'
import type { SessionInfo } from '@/contracts'
import { isApiError } from '@/shared/api/api-error'
import { sessionStore } from '@/shared/session/session-store'
import { sessionQueryOptions } from './session'

/**
 * `beforeLoad` of the `_authenticated` layout. Without a valid session the user is sent to
 * `/login` with the requested location in `redirect`, so the flow resumes after login.
 * The session is validated through the Query cache (`GET /session` at most once per token).
 */
export async function requireSession(queryClient: QueryClient, location: ParsedLocation): Promise<SessionInfo> {
  const token = sessionStore.getToken()
  if (!token) {
    throw redirect({ to: '/login', search: { redirect: location.href, reason: 'required' } })
  }
  try {
    return await ensureSession(queryClient, token)
  } catch (error) {
    if (isApiError(error) && error.isUnauthorized) {
      throw redirect({ to: '/login', search: { redirect: location.href, reason: 'expired' } })
    }
    throw error
  }
}

/**
 * `GET /session` through the cache. While it is in flight the pending screen renders, and a
 * component unmounting may cancel the shared request (the last observer leaves): the guard then
 * simply asks again instead of failing the navigation.
 */
async function ensureSession(queryClient: QueryClient, token: string) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await queryClient.ensureQueryData(sessionQueryOptions(token))
    } catch (error) {
      if (!isCancelledError(error) || attempt >= 2) throw error
    }
  }
}

/**
 * `beforeLoad` of `/login` and `/register`: an authenticated user goes straight to the target.
 * The stored token is validated first (after a refresh the cache is empty).
 */
export async function redirectIfAuthenticated(queryClient: QueryClient, target: string) {
  const token = sessionStore.getToken()
  if (!token) return
  const session = await queryClient.ensureQueryData(sessionQueryOptions(token)).catch(() => null)
  if (session) throw redirect({ href: target, replace: true })
}
