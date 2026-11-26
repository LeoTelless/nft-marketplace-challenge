import { z } from 'zod'
import { ethAmountSchema, idSchema, isoDateSchema, networkSchema, nonNegativeIntSchema, quantitySchema } from './common'

/**
 * `POST /quotes` computes the authoritative totals for the current cart.
 * The quote is the only source of the amounts shown at checkout and is
 * referenced by the order. 422 `coupon_invalid` / `coupon_expired` (field `couponCode`).
 */
export const quoteRequestSchema = z.object({
  couponCode: z.string().trim().min(1).max(32).optional(),
  network: networkSchema,
})
export type QuoteRequest = z.infer<typeof quoteRequestSchema>

/**
 * Blocking problems of a line. Price changes are not issues: they show up as a different
 * `fingerprint` (and as `unitPrice` != `addedUnitPrice` in the cart) and require a new
 * confirmation of the fresh quote.
 */
export const quoteIssueSchema = z.object({
  type: z.enum(['insufficient_availability', 'sold_out']),
  nftId: idSchema,
  editionId: idSchema,
  message: z.string(),
})
export type QuoteIssue = z.infer<typeof quoteIssueSchema>

export const quoteLineSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  nftName: z.string(),
  editionName: z.string(),
  imageUrl: z.string(),
  quantity: quantitySchema,
  unitPrice: ethAmountSchema,
  lineTotal: ethAmountSchema,
  available: nonNegativeIntSchema,
})
export type QuoteLine = z.infer<typeof quoteLineSchema>

export const couponSchema = z.object({
  code: z.string(),
  percentOff: z.number().int().min(1).max(100),
})
export type Coupon = z.infer<typeof couponSchema>

export const quoteSchema = z.object({
  id: idSchema,
  /**
   * Content fingerprint (lines, prices, coupon, fee). An order is accepted only
   * if recomputing the quote yields the same fingerprint; otherwise 409 `quote_outdated`.
   */
  fingerprint: z.string(),
  cartVersion: z.number().int(),
  lines: z.array(quoteLineSchema),
  coupon: couponSchema.nullable(),
  network: networkSchema,
  subtotal: ethAmountSchema,
  discount: ethAmountSchema,
  networkFee: ethAmountSchema,
  total: ethAmountSchema,
  /** Non-empty when some line cannot be bought as is; such a quote cannot be ordered. */
  issues: z.array(quoteIssueSchema),
  createdAt: isoDateSchema,
  expiresAt: isoDateSchema,
})
export type Quote = z.infer<typeof quoteSchema>

/** `details` of a 409 `quote_outdated`. */
export const quoteOutdatedDetailsSchema = z.object({
  quote: quoteSchema,
})
