import axios, { type AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { DEFAULT_API_BASE_URL, HEADERS } from '@/contracts'
import { emitSessionExpired, sessionStore } from '@/shared/session/session-store'
import { ApiError, toApiError } from './api-error'

/**
 * Single Axios instance for every REST call. Responsibilities:
 * - base URL from `VITE_API_URL` (defaults to same-origin `/api`, intercepted by MSW);
 * - session token (`Authorization: Bearer`) and visitor cart (`X-Cart-Id`);
 * - 401 on an authenticated request: emits `session:expired` (the app decides what to do);
 * - every failure is normalized into a typed `ApiError`.
 * Cancellation: callers pass the `AbortSignal` from TanStack Query.
 *
 * Timeout: 10 s for every request (`POST /orders` sets the same value explicitly). A read that
 * times out is not retried (see `shouldRetryQuery`), so the worst wait before an error with
 * "Tentar novamente" is ~10 s.
 */
export const REQUEST_TIMEOUT_MS = 10_000

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
  // Arrays as repeated params: `category=art&category=music`.
  paramsSerializer: { indexes: null },
})

http.interceptors.request.use((config) => {
  const token = sessionStore.getToken()
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  config.headers.set(HEADERS.cartId, sessionStore.getGuestCartId())
  return config
})

http.interceptors.response.use(undefined, (error: unknown) => {
  const apiError = toApiError(error)
  const sentToken = axios.isAxiosError(error) && Boolean(error.config?.headers?.Authorization)
  const background = axios.isAxiosError(error) && error.config?.background === true
  if (apiError.status === 401 && sentToken && !background) {
    // Only a request that carried a token can "expire" a session; a failed login is just a 401.
    sessionStore.setToken(null)
    emitSessionExpired({ reason: apiError.code === 'session_expired' ? 'session_expired' : 'unauthorized' })
  }
  return Promise.reject(apiError)
})

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Background request of the infrastructure (not asked for by a screen): a 401 only fails
     * it, without ending the session. Used by the realtime layer, whose snapshot may still be in
     * flight when the user logs out (the server then answers 401 for the revoked token).
     */
    background?: boolean
  }
}

export type RequestOptions = Pick<AxiosRequestConfig, 'signal' | 'params' | 'headers' | 'timeout'>

/**
 * Performs a request and validates the response body against the contract.
 * A body that does not match is a bug in the API (or mock), surfaced as `invalid_response`.
 */
export async function request<S extends z.ZodType>(
  schema: S,
  config: AxiosRequestConfig,
): Promise<z.output<S>> {
  const response = await http.request<unknown>(config)
  const parsed = schema.safeParse(response.data)
  if (!parsed.success) {
    throw new ApiError({
      kind: 'invalid_response',
      status: response.status,
      message: `Response of ${config.method?.toUpperCase() ?? 'GET'} ${config.url} does not match the contract`,
      cause: parsed.error,
    })
  }
  return parsed.data
}

/** For endpoints that answer 204. */
export async function requestVoid(config: AxiosRequestConfig): Promise<void> {
  await http.request(config)
}
