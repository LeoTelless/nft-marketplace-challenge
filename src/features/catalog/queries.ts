import { keepPreviousData, queryOptions, useQueries, useQuery, type QueryClient } from '@tanstack/react-query'
import type { Nft, NftCategory, NftListQuery, NftListResponse } from '@/contracts'
import { queryKeys } from '@/shared/api/query-keys'
import { catalogApi } from './api'
import { CATEGORIES_ALPHABETICAL } from './catalog-search'

/**
 * Catalog list. The key is the exact query sent to the API; TanStack Query passes the
 * `signal`, so when the key changes (new filter, page…) the obsolete request is aborted and
 * its response can never overwrite the current one (out-of-order responses are discarded).
 * `keepPreviousData` keeps the previous page on screen while the next one loads
 * (background update, shown with a discreet indicator).
 */
export function nftListQueryOptions(query: NftListQuery) {
  return queryOptions({
    queryKey: queryKeys.nfts.list(query),
    queryFn: ({ signal }) => catalogApi.list(query, { signal }),
    placeholderData: keepPreviousData,
  })
}

export function useNftList(query: NftListQuery) {
  return useQuery(nftListQueryOptions(query))
}

/** Looks for the NFT in any cached list page (instant detail while the full record loads). */
function findInLists(queryClient: QueryClient, id: string): Nft | undefined {
  for (const [, page] of queryClient.getQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() })) {
    const found = page?.items.find((item) => item.id === id)
    if (found) return found
  }
  return undefined
}

export function nftDetailQueryOptions(id: string, queryClient?: QueryClient) {
  return queryOptions({
    queryKey: queryKeys.nfts.detail(id),
    queryFn: ({ signal }) => catalogApi.detail(id, { signal }),
    placeholderData: queryClient ? () => findInLists(queryClient, id) : undefined,
  })
}

/** Featured NFTs for the hero and the "NFT em destaque" banner. */
export const FEATURED_QUERY: NftListQuery = { featured: true, sort: 'newest', page: 1, pageSize: 4 }

/**
 * Per-category totals shown next to each collection filter ("Arte digital (8)").
 * The API has no facets endpoint, so it is one tiny request per category (`pageSize=1`,
 * only `total` is read), cached for 5 min.
 */
export function useCategoryCounts(): Partial<Record<NftCategory, number>> {
  return useQueries({
    queries: CATEGORIES_ALPHABETICAL.map((category) => {
      const query: NftListQuery = { category: [category], page: 1, pageSize: 1 }
      return {
        queryKey: queryKeys.nfts.list(query),
        queryFn: ({ signal }: { signal: AbortSignal }) => catalogApi.list(query, { signal }),
        staleTime: 5 * 60_000,
        select: (page: NftListResponse) => page.total,
      }
    }),
    combine: (results) =>
      Object.fromEntries(
        CATEGORIES_ALPHABETICAL.flatMap((category, index) => {
          const total = results[index]?.data
          return total === undefined ? [] : [[category, total]]
        }),
      ),
  })
}
