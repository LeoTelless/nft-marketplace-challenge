import type { QueryClient } from '@tanstack/react-query'
import type { Cart, Nft, NftListResponse, NftUpdatedEvent, Order, OrderUpdatedEvent, Quote } from '@/contracts'
import { queryKeys } from '@/shared/api/query-keys'

/**
 * Cache updates driven by Socket.IO events. Only called from the socket listener
 * (never from UI code), after the event passed the `EventGuard`.
 */

function newer<T extends { version: number }>(current: T | undefined, incoming: T): boolean {
  return !current || incoming.version > current.version
}

/** Version of resource `id` inside a cached value: a snapshot (`{ id, version }`) or a page/list (`{ items }`). */
function versionIn(data: unknown, id: string): number {
  if (!data || typeof data !== 'object') return 0
  const record = data as { id?: unknown; version?: unknown; items?: unknown }
  let version = record.id === id && typeof record.version === 'number' ? record.version : 0
  if (Array.isArray(record.items)) {
    for (const item of record.items as Array<{ id?: unknown; version?: unknown }>) {
      if (item?.id === id && typeof item.version === 'number') version = Math.max(version, item.version)
    }
  }
  return version
}

function cachedVersion(queryClient: QueryClient, queryKey: readonly unknown[], id: string): number {
  let version = 0
  for (const query of queryClient.getQueryCache().findAll({ queryKey })) {
    version = Math.max(version, versionIn(query.state.data, id))
  }
  return version
}

/**
 * Highest version of the NFT already in the cache (detail or any list page), as returned by
 * REST or applied from an earlier event. An event at or below it carries nothing new.
 */
export function cachedNftVersion(queryClient: QueryClient, nftId: string): number {
  return cachedVersion(queryClient, queryKeys.nfts.all(), nftId)
}

/** Same for an order of `userId` (detail or the orders list). */
export function cachedOrderVersion(queryClient: QueryClient, userId: string, orderId: string): number {
  return cachedVersion(queryClient, queryKeys.user.orders(userId), orderId)
}

function cartReferencesNft(data: unknown, nftId: string): boolean {
  if (!data || typeof data !== 'object') return false
  if ('items' in data && Array.isArray((data as Cart).items)) {
    return (data as Cart).items.some((item) => item.nftId === nftId)
  }
  if ('lines' in data && Array.isArray((data as Quote).lines)) {
    return (data as Quote).lines.some((line) => line.nftId === nftId)
  }
  return false
}

export function applyNftUpdated(queryClient: QueryClient, event: NftUpdatedEvent) {
  const nft = event.data

  // Detail: replace the snapshot if it is newer.
  queryClient.setQueryData<Nft>(queryKeys.nfts.detail(nft.id), (current) =>
    current && !newer(current, nft) ? current : current ? nft : undefined,
  )

  // Lists: patch the item in place on every cached page that contains it.
  queryClient.setQueriesData<NftListResponse>({ queryKey: queryKeys.nfts.lists() }, (page) => {
    if (!page || !page.items.some((item) => item.id === nft.id && newer(item, nft))) return page
    return { ...page, items: page.items.map((item) => (item.id === nft.id ? nft : item)) }
  })
  // Price/availability changes may move the NFT in or out of filtered/sorted lists:
  // mark them stale without refetching now (refetched on next mount/focus).
  queryClient.invalidateQueries({ queryKey: queryKeys.nfts.lists(), refetchType: 'none' })

  // Cart and quotes are server-computed: refetch the ones that reference this NFT.
  queryClient.invalidateQueries({
    queryKey: queryKeys.cart.all(),
    predicate: (query) => cartReferencesNft(query.state.data, nft.id),
  })
}

export function applyOrderUpdated(queryClient: QueryClient, event: OrderUpdatedEvent) {
  const order = event.data
  queryClient.setQueryData<Order>(queryKeys.user.order(event.userId, order.id), (current) =>
    current && !newer(current, order) ? current : order,
  )
  queryClient.invalidateQueries({ queryKey: queryKeys.user.orders(event.userId), exact: true })
  if (order.status === 'confirmed') {
    // Purchased quantities were removed from the cart server-side.
    queryClient.invalidateQueries({ queryKey: queryKeys.cart.all() })
  }
}
