import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { NftListQuery } from '@/contracts'
import { catalogApi } from '@/features/catalog/api'
import { queryKeys } from '@/shared/api/query-keys'
import { formatEth } from '@/shared/lib/eth'
import { useRealtimeStatus } from '@/shared/realtime/realtime-provider'
import { Skeleton } from '@/shared/ui/skeleton'

/**
 * Provisional home: proves the REST (Axios + Query + MSW) and Socket.IO paths end to end.
 * Replaced by the real catalog once the Figma layout is available.
 */
export const Route = createFileRoute('/')({
  component: HomePage,
})

const LIST_QUERY: NftListQuery = { page: 1, pageSize: 12, sort: 'newest' }

function HomePage() {
  const realtime = useRealtimeStatus()
  const list = useQuery({
    queryKey: queryKeys.nfts.list(LIST_QUERY),
    queryFn: ({ signal }) => catalogApi.list(LIST_QUERY, { signal }),
    placeholderData: keepPreviousData,
  })

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">NFT Marketplace</h1>
      <p className="text-muted-foreground text-sm" data-testid="realtime-status">
        Realtime: {realtime}
      </p>

      {list.isPending ? (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading NFTs">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Skeleton className="h-20 w-full" />
            </li>
          ))}
        </ul>
      ) : list.isError ? (
        <div role="alert" className="mt-4">
          <p>Could not load the catalog: {list.error.message}</p>
          <button type="button" className="mt-2 underline" onClick={() => void list.refetch()}>
            Try again
          </button>
        </div>
      ) : list.data.items.length === 0 ? (
        <p className="mt-4">No NFTs found.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="nft-list">
          {list.data.items.map((nft) => (
            <li key={nft.id} data-testid="nft-card" data-nft-id={nft.id} className="rounded-md border p-3">
              <p className="font-medium">{nft.name}</p>
              <p data-testid="nft-price">{formatEth(nft.minPrice)}</p>
              <p className="text-muted-foreground text-sm" data-testid="nft-availability">
                {nft.totalAvailable > 0 ? `${nft.totalAvailable} available` : 'Sold out'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
