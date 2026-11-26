import { toSocketIo } from '@mswjs/socket.io-binding'
import { ws, type WebSocketHandlerConnection } from 'msw'
import {
  REALTIME_EVENTS,
  SOCKET_UNAUTHORIZED,
  socketAuthSchema,
  type Nft,
  type NftUpdatedEvent,
  type OrderUpdatedEvent,
  type RealtimeEvent,
} from '@/contracts'
import { findNft, nextEventId, onDbChange, persist } from './db/store'
import { findValidSession } from './handlers/utils'
import { is } from './scenarios'

/**
 * Simulated Socket.IO server on top of MSW's WebSocket interception and
 * `@mswjs/socket.io-binding` (which encodes/decodes the Engine.IO + Socket.IO framing).
 *
 * Limitations of the binding, handled here:
 * - It answers the Engine.IO handshake itself (`pingInterval: 25000, pingTimeout: 5000`) but
 *   never pings. Without pings the client closes the connection after ~30 s ("ping timeout"),
 *   so this server sends an Engine.IO ping (`2`) every 20 s; the client's pong is ignored.
 * - It acknowledges the namespace CONNECT immediately and only decodes EVENT packets, so the
 *   `auth` payload of the client CONNECT packet (`40{"token":...}`) is read from the raw frame.
 *   An invalid token gets a CONNECT_ERROR (`44{"message":"unauthorized"}`), which makes
 *   socket.io-client emit `connect_error` and stop reconnecting.
 * - Only the default namespace, no rooms/broadcast and only the `websocket` transport (no
 *   HTTP long-polling). Per-user delivery is done by keeping the authenticated user per peer.
 */
const ENGINE_IO_PING_MS = 20_000

const socketOrigin = (import.meta.env.VITE_SOCKET_URL || location.origin).replace(/^http/, 'ws').replace(/\/$/, '')
/**
 * MSW strips the `/socket.io/` prefix from Socket.IO client URLs before matching, so the
 * link targets the origin root. Other WebSockets to the root (e.g. Vite HMR in dev) are passed
 * through to the real server.
 */
export const socketLink = ws.link(socketOrigin)

interface Peer {
  connection: WebSocketHandlerConnection
  emit: (event: string, payload: unknown) => void
  /** `undefined` until the CONNECT packet arrives; `null` = visitor. */
  userId: string | null | undefined
}

const peers = new Set<Peer>()
let socketDown = false
const recentEvents: RealtimeEvent[] = []
const previousSnapshots = new Map<string, Nft>()

export const socketHandler = socketLink.addEventListener('connection', (connection) => {
  if (!connection.client.url.searchParams.has('EIO')) {
    connection.server.connect()
    return
  }
  if (socketDown || is('offline')) {
    connection.client.close(4000, 'Simulated outage')
    return
  }

  const io = toSocketIo(connection)
  const peer: Peer = {
    connection,
    emit: (event, payload) => io.client.emit(event, payload),
    userId: undefined,
  }
  peers.add(peer)

  const ping = setInterval(() => safeSend(connection, '2'), ENGINE_IO_PING_MS)

  connection.client.addEventListener('message', (event) => {
    const data = event.data
    if (typeof data !== 'string' || !data.startsWith('40')) return
    let auth: unknown = { token: null }
    try {
      auth = data.length > 2 ? JSON.parse(data.slice(2)) : { token: null }
    } catch {
      // malformed auth payload: treated as unauthorized below
      auth = { token: 'invalid' }
    }
    const parsed = socketAuthSchema.safeParse(auth)
    const token = parsed.success ? parsed.data.token : 'invalid'
    if (!token) {
      peer.userId = null
      return
    }
    const found = findValidSession(token)
    if (!found) {
      safeSend(connection, `44${JSON.stringify({ message: SOCKET_UNAUTHORIZED })}`)
      peers.delete(peer)
      return
    }
    peer.userId = found.user.id
  })

  connection.client.addEventListener('close', () => {
    clearInterval(ping)
    peers.delete(peer)
  })
})

function safeSend(connection: WebSocketHandlerConnection, data: string) {
  try {
    connection.client.send(data)
  } catch {
    // connection already closed
  }
}

function deliver(event: RealtimeEvent) {
  recentEvents.push(event)
  if (recentEvents.length > 50) recentEvents.shift()
  for (const peer of peers) {
    if (peer.userId === undefined) continue
    if (event.type === 'order.updated' && peer.userId !== event.userId) continue
    peer.emit(event.type, event)
  }
}

/** Every db mutation of an NFT/order becomes an event: REST and realtime stay consistent. */
export function startRealtimeBridge() {
  return onDbChange((change) => {
    if (change.type === 'nft') {
      previousSnapshots.set(change.nft.id, change.previous)
      const event: NftUpdatedEvent = {
        eventId: nextEventId(),
        type: REALTIME_EVENTS.nftUpdated,
        resource: { type: 'nft', id: change.nft.id },
        version: change.nft.version,
        occurredAt: new Date().toISOString(),
        data: change.nft,
      }
      persist()
      deliver(event)
    } else {
      const event: OrderUpdatedEvent = {
        eventId: nextEventId(),
        type: REALTIME_EVENTS.orderUpdated,
        resource: { type: 'order', id: change.order.id },
        userId: change.userId,
        version: change.order.version,
        occurredAt: new Date().toISOString(),
        data: change.order,
      }
      persist()
      deliver(event)
    }
  })
}

// ---------------------------------------------------------------- test controls

/** Re-sends an already emitted event (same `eventId`): the client must ignore it. */
export function replayLastEvent(filter?: (event: RealtimeEvent) => boolean): RealtimeEvent | null {
  const event = [...recentEvents].reverse().find((e) => !filter || filter(e)) ?? null
  if (event) deliver(event)
  return event
}

/**
 * Emits an `nft.updated` with a fresh `eventId` but an old version (the previous snapshot,
 * or the current one at a lower version): the client must not regress.
 */
export function emitStaleNftEvent(nftId: string): NftUpdatedEvent | null {
  const current = findNft(nftId)
  if (!current) return null
  const previous = previousSnapshots.get(nftId)
  const data: Nft = previous ?? {
    ...current,
    editions: current.editions.map((e) => ({ ...e, price: '0.000001' })),
    minPrice: '0.000001',
  }
  const event: NftUpdatedEvent = {
    eventId: nextEventId(),
    type: REALTIME_EVENTS.nftUpdated,
    resource: { type: 'nft', id: nftId },
    version: previous ? previous.version : Math.max(1, current.version - 1),
    occurredAt: new Date().toISOString(),
    data: { ...data, version: previous ? previous.version : Math.max(1, current.version - 1) },
  }
  deliver(event)
  return event
}

/** Closes every socket and refuses new connections until `restoreSockets()`. */
export function dropSockets() {
  socketDown = true
  for (const peer of [...peers]) peer.connection.client.close(4000, 'Simulated outage')
  peers.clear()
}

export function restoreSockets() {
  socketDown = false
}

export function connectedPeers() {
  return [...peers].map((p) => ({ userId: p.userId ?? null }))
}
