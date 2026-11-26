import { endpoints, favoritesSchema } from '@/contracts'
import { request, type RequestOptions } from '@/shared/api/http'

export const favoritesApi = {
  list: (options?: RequestOptions) => request(favoritesSchema, { url: endpoints.favorites, ...options }),
  add: (nftId: string) => request(favoritesSchema, { method: 'PUT', url: endpoints.favorite(nftId) }),
  remove: (nftId: string) => request(favoritesSchema, { method: 'DELETE', url: endpoints.favorite(nftId) }),
}
