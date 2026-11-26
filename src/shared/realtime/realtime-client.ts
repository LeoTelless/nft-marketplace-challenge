import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import {
  endpoints,
  nftUpdatedEventSchema,
  orderListSchema,
  orderUpdatedEventSchema,
  REALTIME_EVENTS,
  SOCKET_PATH,
  SOCKET_UNAUTHORIZED,
  systemResyncEventSchema,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type SocketAuth,
} from '@/contracts'
import { request } from '@/shared/api/http'
import { emitSessionExpired } from '@/shared/session/session-store'
import { applyNftUpdated, applyOrderUpdated, cachedNftVersion, cachedOrderVersion } from './apply-events'
import { EventGuard, sessionGuardStorage } from './event-guard'

/**
 * Socket.IO client.
 *
 * - Transport: `websocket` only. The MSW binding (`@mswjs/socket.io-binding`) intercepts
 *   WebSocket connections; HTTP long-polling is not supported in the mocked environment.
 * - `socket.io-client` is loaded with a dynamic `import()` *after* `worker.start()`:
 *   engine.io-client captures `globalThis.WebSocket` when its module is evaluated, so a
 *   static import would grab the native WebSocket before MSW patches it.
 * - One connection per session: authenticated with the session token in the CONNECT packet
 *   (`auth: { token }`), destroyed on logout or user switch. Visitors connect with
 *   `token: null` and receive public events only.
 * - Events go through an `EventGuard` (duplicates / stale versions) and then update the
 *   TanStack Query cache. An event is applied (cache, refetch, notice) only if its version is
 *   greater than every version the client knows for that resource, so a duplicate or an old
 *   event never repeats an effect, also after a reload, a reconnection or a new login:
 *   - `nft.updated` (public data): one guard for the tab, persisted in `sessionStorage`, plus
 *     the version already in the cache (detail and list pages returned by REST);
 *   - `order.updated` (private): one guard per connection, seeded with a REST snapshot of the
 *     user's orders (`GET /orders`) taken when the connection is created; order events wait for
 *     it, then are compared with it and with the cache. Nothing of a user outlives its connection.
 * - On reconnection every query is invalidated (active ones refetch), reconciling whatever was
 *   missed while offline. `system.resync` (server data replaced as a whole) does the same.
 */

export type RealtimeStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unauthorized'

export type RealtimeNotice =
  | { type: 'nft.updated'; event: NftUpdatedEvent }
  | { type: 'order.updated'; event: OrderUpdatedEvent }
  | { type: 'reconnected' }

type StatusListener = (status: RealtimeStatus) => void
type NoticeListener = (notice: RealtimeNotice) => void

let status: RealtimeStatus = 'idle'
const statusListeners = new Set<StatusListener>()
const noticeListeners = new Set<NoticeListener>()

let latestConnectionId = 0

/** Public events (catalog) are the same for every user: one guard per tab, kept across reloads. */
const PUBLIC_GUARD_KEY = 'nft.realtime.public-events'
let publicGuard: EventGuard | null = null
function nftGuard(): EventGuard {
  publicGuard ??= new EventGuard({ maxRemembered: 300, storage: sessionGuardStorage(PUBLIC_GUARD_KEY) })
  return publicGuard
}

/** Bound on how long order events may wait for the snapshot of the user's orders. */
const ORDER_SNAPSHOT_TIMEOUT_MS = 3_000

function setGlobalStatus(next: RealtimeStatus) {
  if (next === status) return
  status = next
  for (const listener of statusListeners) listener(status)
}

export const realtimeStatus = {
  get: () => status,
  subscribe(listener: StatusListener) {
    statusListeners.add(listener)
    return () => statusListeners.delete(listener)
  },
}

/** UI feedback hook (toasts, aria-live). Called after the cache has been updated. */
export function onRealtimeNotice(listener: NoticeListener): () => void {
  noticeListeners.add(listener)
  return () => noticeListeners.delete(listener)
}

function notice(n: RealtimeNotice) {
  for (const listener of noticeListeners) listener(n)
}

export interface RealtimeConnection {
  /** Idempotent. After it returns, this connection never opens a socket, touches the cache or writes status. */
  destroy(): void
}

export interface ConnectRealtimeOptions {
  queryClient: QueryClient
  token: string | null
  /** Id of the authenticated user; `order.updated` for any other user is ignored. */
  userId: string | null
  url?: string
}

/**
 * Creates a connection synchronously and opens the socket once `socket.io-client` is loaded.
 *
 * Lifecycle guarantees (the provider may create and destroy connections concurrently:
 * StrictMode double effects, token then token+user on reload, user switch):
 * - the connection id is taken synchronously, so creation order = recency order, no matter
 *   in which order the dynamic imports resolve;
 * - a connection destroyed before the import resolves never opens a socket;
 * - only the most recent live connection writes the shared status; destroying a superseded
 *   connection never overwrites the status of the live one;
 * - every listener checks `disposed` first, so nothing from a previous session can reach the
 *   cache after `destroy()` (and `order.updated` is also filtered by `userId`).
 */
export function connectRealtime(options: ConnectRealtimeOptions): RealtimeConnection {
  const { queryClient, token, userId } = options
  const connectionId = ++latestConnectionId
  let disposed = false
  let socket: Socket | null = null
  const publicEvents = nftGuard()
  const orderEvents = new EventGuard()
  // Order events are handled in arrival order, after the snapshot of the user's orders: an event
  // for an order already in that state (e.g. a re-delivery after a new login) changes nothing.
  let orderQueue: Promise<void> = userId ? snapshotOrders(orderEvents, () => disposed) : Promise.resolve()

  const isCurrent = () => !disposed && connectionId === latestConnectionId
  const setStatus = (next: RealtimeStatus) => {
    if (isCurrent()) setGlobalStatus(next)
  }

  setStatus('connecting')

  void import('socket.io-client').then(({ io }) => {
    if (disposed) return
    const auth: SocketAuth = { token }
    const created = io(options.url ?? (import.meta.env.VITE_SOCKET_URL || window.location.origin), {
      path: SOCKET_PATH,
      transports: ['websocket'],
      auth,
      // Reconnection policy (explicit, so recovery time is bounded and reproducible):
      // - backoff 300 ms doubling up to 2 s, without jitter (randomizationFactor 0);
      // - an attempt that gets no Engine.IO handshake is abandoned and retried after 4 s
      //   (socket.io-client default: 20 s, which made recovery take 15-20 s after an outage).
      // Worst case after the network returns: one pending attempt (<= 4 s) + one delay (<= 2 s);
      // with the mock, held attempts are answered on `restoreSocket()`, so it is immediate.
      reconnectionDelay: 300,
      reconnectionDelayMax: 2_000,
      randomizationFactor: 0,
      timeout: 4_000,
    })
    socket = created

    created.on('connect', () => setStatus('connected'))
    created.on('disconnect', (reason) => {
      // "io client disconnect" = we closed it (logout / user switch): no reconnection.
      setStatus(reason === 'io client disconnect' ? 'idle' : 'reconnecting')
    })
    created.on('connect_error', (error) => {
      if (disposed) return
      if (error.message === SOCKET_UNAUTHORIZED) {
        setStatus('unauthorized')
        emitSessionExpired({ reason: 'session_expired' })
        return
      }
      setStatus('reconnecting')
    })
    created.io.on('reconnect', () => {
      if (disposed) return
      // Reconciliation: anything may have changed while the socket was down.
      void queryClient.invalidateQueries()
      notice({ type: 'reconnected' })
    })

    created.on(REALTIME_EVENTS.nftUpdated, (payload: unknown) => {
      if (disposed) return
      const parsed = nftUpdatedEventSchema.safeParse(payload)
      if (!parsed.success) return warnInvalid(REALTIME_EVENTS.nftUpdated, parsed.error)
      if (!publicEvents.accept(parsed.data, cachedNftVersion(queryClient, parsed.data.resource.id))) return
      applyNftUpdated(queryClient, parsed.data)
      notice({ type: 'nft.updated', event: parsed.data })
    })

    created.on(REALTIME_EVENTS.orderUpdated, (payload: unknown) => {
      if (disposed) return
      const parsed = orderUpdatedEventSchema.safeParse(payload)
      if (!parsed.success) return warnInvalid(REALTIME_EVENTS.orderUpdated, parsed.error)
      // Defense in depth: the server only targets the owner, but never apply another user's data.
      if (!userId || parsed.data.userId !== userId) return
      const event = parsed.data
      orderQueue = orderQueue
        .then(() => {
          if (disposed) return
          if (!orderEvents.accept(event, cachedOrderVersion(queryClient, userId, event.resource.id))) return
          applyOrderUpdated(queryClient, event)
          notice({ type: 'order.updated', event })
        })
        // A failing listener must not stall the queue for the next events.
        .catch((error: unknown) => console.error('[realtime] failed to apply "order.updated"', error))
    })

    created.on(REALTIME_EVENTS.resync, (payload: unknown) => {
      if (disposed) return
      const parsed = systemResyncEventSchema.safeParse(payload)
      if (!parsed.success) return warnInvalid(REALTIME_EVENTS.resync, parsed.error)
      // The server replaced its data: refetch everything that is shown (as on a reconnection).
      void queryClient.invalidateQueries()
    })
  })

  return {
    destroy() {
      if (disposed) return
      // Report idle only if no newer connection took over (checked before marking disposed).
      if (connectionId === latestConnectionId) setGlobalStatus('idle')
      disposed = true
      if (socket) {
        socket.removeAllListeners()
        socket.io.removeAllListeners()
        socket.disconnect()
        socket = null
      }
      orderEvents.clear()
    },
  }
}

/** Seeds `guard` with the current version of each order of the session user (best effort). */
async function snapshotOrders(guard: EventGuard, isDisposed: () => boolean): Promise<void> {
  try {
    const { items } = await request(orderListSchema, {
      url: endpoints.orders,
      timeout: ORDER_SNAPSHOT_TIMEOUT_MS,
      // A 401 here (e.g. logout while the snapshot is in flight) must not end the session.
      background: true,
    })
    if (isDisposed()) return
    for (const order of items) guard.observe('order', order.id, order.version)
  } catch {
    // No snapshot (offline, 5xx, timeout): events are still compared with the cache.
  }
}

function warnInvalid(event: string, error: unknown) {
  console.warn(`[realtime] dropped invalid "${event}" payload`, error)
}
