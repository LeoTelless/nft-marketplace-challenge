import { endpoints, nftListResponseSchema, nftSchema, type NftListQuery } from '@/contracts'
import { request, type RequestOptions } from '@/shared/api/http'

export const catalogApi = {
  /** The `signal` cancels the request when the query key changes (obsolete response discarded). */
  list: (query: NftListQuery, options?: RequestOptions) =>
    request(nftListResponseSchema, { url: endpoints.nfts, params: query, ...options }),
  detail: (id: string, options?: RequestOptions) => request(nftSchema, { url: endpoints.nft(id), ...options }),
}
