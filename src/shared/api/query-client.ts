import { MutationCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from './api-error'

/**
 * Cache, retry and sync policy (documented in ARCHITECTURE.md as well).
 *
 * Queries
 * - `staleTime` 30s: catalog data is kept fresh by `nft.updated` events, so refetching
 *   on every mount is unnecessary. Private data uses the same value; mutations and events
 *   invalidate it explicitly.
 * - `gcTime` 5 min: inactive data is kept for back/forward navigation.
 * - Retry: never on 4xx (the same request would fail again) nor on cancellation; up to
 *   2 retries with exponential backoff (500ms, 1s… capped at 4s) on transient failures
 *   (network, 5xx). A timeout is not retried: the server already took the whole timeout
 *   (10 s, `shared/api/http.ts`), and three attempts would keep the skeleton for ~32 s before
 *   the error. Worst case is therefore ~10 s for a timeout and ~1.5 s plus 3 round trips for
 *   a failing network or 5xx.
 * - `refetchOnWindowFocus` on (cheap reconciliation); on reconnect of the browser too.
 *   Socket.IO reconnection triggers its own reconciliation (see `shared/realtime`).
 *
 * Mutations
 * - `retry: 0` globally. Mutations are never retried automatically: a retry could
 *   repeat a side effect. Order creation in particular is only re-sent by an explicit
 *   user action, with the same `Idempotency-Key`, so the server returns the same order.
 */
export const QUERY_STALE_TIME = 30_000
export const QUERY_GC_TIME = 5 * 60_000
export const MAX_QUERY_RETRIES = 2

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return false
  if (error.kind === 'canceled' || error.kind === 'invalid_response' || error.kind === 'timeout') return false
  if (!error.isTransient) return false
  return failureCount < MAX_QUERY_RETRIES
}

export function retryDelay(attempt: number): number {
  return Math.min(500 * 2 ** attempt, 4_000)
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache(),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME,
        gcTime: QUERY_GC_TIME,
        retry: shouldRetryQuery,
        retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  })
}
