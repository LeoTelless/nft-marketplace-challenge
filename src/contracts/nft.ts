import { z } from 'zod'
import {
  ethAmountSchema,
  idSchema,
  isoDateSchema,
  nonNegativeIntSchema,
  paginatedSchema,
  resourceVersionSchema,
} from './common'

export const nftCategorySchema = z.enum(['art', 'gaming', 'music', 'photography', 'collectibles', 'sports'])
export type NftCategory = z.infer<typeof nftCategorySchema>

/** Each NFT is sold in one or more editions, each with its own price and availability. */
export const editionSchema = z.object({
  id: idSchema,
  name: z.string(),
  price: ethAmountSchema,
  supply: z.number().int().min(1),
  available: nonNegativeIntSchema,
  /** Max quantity per order for this edition. */
  maxPerOrder: z.number().int().min(1),
})
export type Edition = z.infer<typeof editionSchema>

export const nftImageSchema = z.object({
  url: z.string(),
  alt: z.string(),
  width: z.number().int(),
  height: z.number().int(),
})
export type NftImage = z.infer<typeof nftImageSchema>

export const creatorSchema = z.object({
  id: idSchema,
  name: z.string(),
  avatarUrl: z.string().nullable(),
})

export const nftSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string(),
  category: nftCategorySchema,
  creator: creatorSchema,
  images: z.array(nftImageSchema).min(1),
  editions: z.array(editionSchema).min(1),
  featured: z.boolean(),
  /** Lowest edition price (derived, used for sorting and price filters). */
  minPrice: ethAmountSchema,
  /** Sum of `available` across editions. 0 means sold out. */
  totalAvailable: nonNegativeIntSchema,
  createdAt: isoDateSchema,
  version: resourceVersionSchema,
})
export type Nft = z.infer<typeof nftSchema>

export const nftSortSchema = z.enum(['newest', 'oldest', 'price_asc', 'price_desc', 'name_asc', 'name_desc'])
export type NftSort = z.infer<typeof nftSortSchema>

export const nftAvailabilityFilterSchema = z.enum(['all', 'available', 'sold_out'])
export type NftAvailabilityFilter = z.infer<typeof nftAvailabilityFilterSchema>

/**
 * `GET /nfts` query. Arrays are sent as repeated params (`category=art&category=music`).
 * Price bounds apply to `minPrice`. Filters combine with AND (categories with OR).
 */
export const nftListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.array(nftCategorySchema).optional(),
  minPrice: ethAmountSchema.optional(),
  maxPrice: ethAmountSchema.optional(),
  availability: nftAvailabilityFilterSchema.default('all'),
  featured: z.boolean().optional(),
  sort: nftSortSchema.default('newest'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(48).default(12),
})
export type NftListQuery = z.input<typeof nftListQuerySchema>
export type NormalizedNftListQuery = z.output<typeof nftListQuerySchema>

/** `GET /nfts` response. `GET /nfts/:id` returns a single `Nft` (404 `not_found`). */
export const nftListResponseSchema = paginatedSchema(nftSchema)
export type NftListResponse = z.infer<typeof nftListResponseSchema>
