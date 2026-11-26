import { z } from 'zod'
import { idSchema, isoDateSchema, resourceVersionSchema } from './common'
import { nftSchema } from './nft'
import { orderSchema } from './orders'

/**
 * Socket.IO events (server to client). Every event carries:
 * - `eventId`: stable identity, used to drop duplicates;
 * - `resource`: the affected resource;
 * - `version`: the resource version after the change; the client drops events whose
 *   version is not greater than the one it already has.
 * `data` is the full resource snapshot at that version.
 */
const eventBase = {
  eventId: idSchema,
  version: resourceVersionSchema,
  occurredAt: isoDateSchema,
}

/** Broadcast to every connected socket (public catalog data). */
export const nftUpdatedEventSchema = z.object({
  ...eventBase,
  type: z.literal('nft.updated'),
  resource: z.object({ type: z.literal('nft'), id: idSchema }),
  data: nftSchema,
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEventSchema>

/** Sent only to sockets authenticated as `userId`. */
export const orderUpdatedEventSchema = z.object({
  ...eventBase,
  type: z.literal('order.updated'),
  resource: z.object({ type: z.literal('order'), id: idSchema }),
  userId: idSchema,
  data: orderSchema,
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEventSchema>

export const REALTIME_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
} as const

export type RealtimeEvent = NftUpdatedEvent | OrderUpdatedEvent

/** Payload of the Socket.IO CONNECT packet (`auth` option). `null` token = visitor (public events only). */
export const socketAuthSchema = z.object({
  token: z.string().nullable(),
})
export type SocketAuth = z.infer<typeof socketAuthSchema>

/** `connect_error` data sent by the server when the token is rejected. */
export const SOCKET_UNAUTHORIZED = 'unauthorized'
