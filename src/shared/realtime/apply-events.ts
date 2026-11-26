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
