import { z } from 'zod'
import { ethAmountSchema, idSchema, isoDateSchema, networkSchema, resourceVersionSchema } from './common'
import { couponSchema, quoteLineSchema } from './quote'

export const orderStatusSchema = z.enum(['pending', 'confirmed', 'rejected'])
export type OrderStatus = z.infer<typeof orderStatusSchema>
/** `confirmed` and `rejected` are terminal: nothing moves an order out of them. */
export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ['confirmed', 'rejected']

export const collectorSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.email(),
})
export type Collector = z.infer<typeof collectorSchema>

/**
 * `POST /orders` (auth). Requires the `Idempotency-Key` header (one key per purchase attempt).
 * - same key + same body: the same order (200), never a second purchase;
 * - same key + different body: 409 `idempotency_conflict`;
 * - stale quote: 409 `quote_outdated` with `details.quote` (the fresh quote);
 * - not enough stock: 409 `availability_conflict`.
 * The order is created `pending` (201) and resolved asynchronously (`order.updated`).
 */
export const createOrderRequestSchema = z.object({
  quoteId: idSchema,
  quoteFingerprint: z.string(),
  walletId: idSchema,
  network: networkSchema,
  collector: collectorSchema,
})
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

/** Immutable snapshot taken at order creation. Later catalog changes never affect it. */
export const receiptSchema = z.object({
  lines: z.array(quoteLineSchema),
  coupon: couponSchema.nullable(),
  subtotal: ethAmountSchema,
  discount: ethAmountSchema,
  networkFee: ethAmountSchema,
  total: ethAmountSchema,
  network: networkSchema,
  walletAddress: z.string(),
  collector: collectorSchema,
})
export type Receipt = z.infer<typeof receiptSchema>

export const transactionSchema = z.object({
  hash: z.string(),
  explorerUrl: z.string(),
})

export const orderSchema = z.object({
  id: idSchema,
  status: orderStatusSchema,
  receipt: receiptSchema,
  /** Only for `confirmed` orders (simulated reference). */
  transaction: transactionSchema.nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  version: resourceVersionSchema,
})
export type Order = z.infer<typeof orderSchema>

/** `GET /orders` (auth). `GET /orders/:id` returns Order (404; 403 for another user's order). */
export const orderListSchema = z.object({ items: z.array(orderSchema) })
export type OrderList = z.infer<typeof orderListSchema>
