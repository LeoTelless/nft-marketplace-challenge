import { z } from 'zod'
import { idSchema } from './common'

/** `GET /favorites` (auth). `PUT /favorites/:nftId` and `DELETE /favorites/:nftId` return the same shape. */
export const favoritesSchema = z.object({
  nftIds: z.array(idSchema),
})
export type Favorites = z.infer<typeof favoritesSchema>
