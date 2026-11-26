import type { QueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import {
  nftUpdatedEventSchema,
  orderUpdatedEventSchema,
  REALTIME_EVENTS,
  SOCKET_PATH,
  SOCKET_UNAUTHORIZED,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type SocketAuth,
} from '@/contracts'
import { emitSessionExpired } from '@/shared/session/session-store'
import { applyNftUpdated, applyOrderUpdated } from './apply-events'
import { EventGuard } from './event-guard'

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
 * - Events go through `EventGuard` (duplicates / stale versions) and then update the
 *   TanStack Query cache. On reconnection every query is invalidated (active ones refetch),
 *   reconciling whatever was missed while offline.
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
  readonly socket: Socket
  destroy(): void
}

export interface ConnectRealtimeOptions {
  queryClient: QueryClient
  token: string | null
  /** Id of the authenticated user; `order.updated` for any other user is ignored. */
  userId: string | null
  url?: string
}

export async function connectRealtime(options: ConnectRealtimeOptions): Promise<RealtimeConnection> {
  const { io } = await import('socket.io-client')
  const { queryClient, token, userId } = options
  const guard = new EventGuard()
  // Only the most recent connection reports status (an older one may still be tearing down).
  const connectionId = ++latestConnectionId
  const setStatus = (next: RealtimeStatus) => {
    if (connectionId === latestConnectionId) setGlobalStatus(next)
  }
  const auth: SocketAuth = { token }

  const socket = io(options.url ?? (import.meta.env.VITE_SOCKET_URL || window.location.origin), {
    path: SOCKET_PATH,
    transports: ['websocket'],
    auth,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3_000,
  })

  setStatus('connecting')

  socket.on('connect', () => setStatus('connected'))
  socket.on('disconnect', (reason) => {
    // "io client disconnect" = we closed it (logout / user switch): no reconnection.
    setStatus(reason === 'io client disconnect' ? 'idle' : 'reconnecting')
  })
  socket.on('connect_error', (error) => {
    if (error.message === SOCKET_UNAUTHORIZED) {
      setStatus('unauthorized')
      emitSessionExpired({ reason: 'session_expired' })
      return
    }
    setStatus('reconnecting')
  })
  socket.io.on('reconnect', () => {
    // Reconciliation: anything may have changed while the socket was down.
    void queryClient.invalidateQueries()
    notice({ type: 'reconnected' })
  })

  socket.on(REALTIME_EVENTS.nftUpdated, (payload: unknown) => {
    const parsed = nftUpdatedEventSchema.safeParse(payload)
    if (!parsed.success) return warnInvalid(REALTIME_EVENTS.nftUpdated, parsed.error)
    if (!guard.accept(parsed.data)) return
    applyNftUpdated(queryClient, parsed.data)
    notice({ type: 'nft.updated', event: parsed.data })
  })

  socket.on(REALTIME_EVENTS.orderUpdated, (payload: unknown) => {
    const parsed = orderUpdatedEventSchema.safeParse(payload)
    if (!parsed.success) return warnInvalid(REALTIME_EVENTS.orderUpdated, parsed.error)
    // Defense in depth: the server only targets the owner, but never apply another user's data.
    if (!userId || parsed.data.userId !== userId) return
    if (!guard.accept(parsed.data)) return
    applyOrderUpdated(queryClient, parsed.data)
    notice({ type: 'order.updated', event: parsed.data })
  })

  return {
    socket,
    destroy() {
      socket.removeAllListeners()
      socket.io.removeAllListeners()
      socket.disconnect()
      guard.clear()
      setStatus('idle')
    },
  }
}

function warnInvalid(event: string, error: unknown) {
  console.warn(`[realtime] dropped invalid "${event}" payload`, error)
}
