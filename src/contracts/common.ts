import { z } from 'zod'

/**
 * ETH amounts always travel as decimal strings (up to 18 decimals, wei precision)
 * and are never converted to `number`. Arithmetic lives in `@/shared/lib/eth`.
 */
export const ethAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,18})?$/, 'Expected a non-negative decimal string with up to 18 decimals')
export type EthAmount = z.infer<typeof ethAmountSchema>

export const idSchema = z.string().min(1)
export const isoDateSchema = z.iso.datetime({ offset: true })
export const quantitySchema = z.number().int().min(1)
export const nonNegativeIntSchema = z.number().int().min(0)

/** Monotonic per-resource version. Higher always wins (REST and events). */
export const resourceVersionSchema = z.number().int().min(1)

export const networkSchema = z.enum(['ethereum', 'polygon', 'arbitrum', 'base'])
export type Network = z.infer<typeof networkSchema>

export function paginatedSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    total: nonNegativeIntSchema,
    totalPages: nonNegativeIntSchema,
  })
}
