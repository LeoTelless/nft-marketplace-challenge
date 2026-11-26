import { z } from 'zod'
import {
  ethAmountSchema,
  idSchema,
  isoDateSchema,
  nonNegativeIntSchema,
  quantitySchema,
  resourceVersionSchema,
} from './common'

/**
 * The cart lives on the (simulated) server. Visitors identify their cart with the
 * `X-Cart-Id` header; authenticated users use their account cart, and the visitor
 * cart is merged into it on login/register (`guestCartId`).
 */
export const cartItemSchema = z.object({
  id: idSchema,
  nftId: idSchema,
  editionId: idSchema,
  quantity: quantitySchema,
  nftName: z.string(),
  editionName: z.string(),
  imageUrl: z.string(),
  /** Current catalog price (always the latest). */
  unitPrice: ethAmountSchema,
  /** Price when the item was added; differs from `unitPrice` after a price change. */
  addedUnitPrice: ethAmountSchema,
  /** Current availability of the edition. */
  available: nonNegativeIntSchema,
  maxPerOrder: z.number().int().min(1),
})
export type CartItem = z.infer<typeof cartItemSchema>

/** `GET /cart`. */
export const cartSchema = z.object({
  id: idSchema,
  items: z.array(cartItemSchema),
  updatedAt: isoDateSchema,
  version: resourceVersionSchema,
})
export type Cart = z.infer<typeof cartSchema>

/** `POST /cart/items` returns Cart. Adds to the existing line of the same NFT+edition. 409 `availability_conflict`. */
export const addCartItemRequestSchema = z.object({
  nftId: idSchema,
  editionId: idSchema,
  quantity: quantitySchema,
})
export type AddCartItemRequest = z.infer<typeof addCartItemRequestSchema>

/** `PATCH /cart/items/:itemId` and `DELETE /cart/items/:itemId` return Cart. */
export const updateCartItemRequestSchema = z.object({
  quantity: quantitySchema,
})
export type UpdateCartItemRequest = z.infer<typeof updateCartItemRequestSchema>
