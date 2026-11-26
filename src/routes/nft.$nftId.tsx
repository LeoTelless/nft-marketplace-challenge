import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { nftDetailQueryOptions } from '@/features/catalog/queries'
import { NftDetail, NftDetailsSection } from '@/features/nft/nft-detail'
import { NftDetailError, NftDetailSkeleton, NftNotFound } from '@/features/nft/nft-detail-states'
import { RelatedNfts } from '@/features/nft/related-nfts'
import { isApiError } from '@/shared/api/api-error'
import { apiErrorMessage } from '@/shared/lib/form-errors'

/**
 * Detalhes do NFT. Works on direct access (the query fetches by id); the loader only
 * prefetches (link hover/intent), errors are rendered by the component: a missing id gets
 * its own screen, other failures an error with retry. `?edition=` keeps the chosen edition.
 */
export const Route = createFileRoute('/nft/$nftId')({
  validateSearch: z.object({ edition: z.string().max(80).optional().catch(undefined) }),
  loader: ({ context, params }) => {
    void context.queryClient.prefetchQuery(nftDetailQueryOptions(params.nftId))
  },
  component: NftPage,
})

function NftPage() {
  const { nftId } = Route.useParams()
  const { edition } = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const query = useQuery(nftDetailQueryOptions(nftId, queryClient))

  if (query.isPending) return <NftDetailSkeleton />
  if (query.isError && !query.data) {
    if (isApiError(query.error) && query.error.isNotFound) return <NftNotFound nftId={nftId} />
    return (
      <NftDetailError
        message={apiErrorMessage(query.error)}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    )
  }

  const nft = query.data
  return (
    <>
      <title>{`${nft.name} · KURIO`}</title>
      <NftDetail
        key={nft.id}
        nft={nft}
        editionId={edition}
        onEditionChange={(editionId) =>
          void navigate({ search: (prev) => ({ ...prev, edition: editionId }), replace: true, resetScroll: false })
        }
      />
      <NftDetailsSection nft={nft} />
      <RelatedNfts nft={nft} />
    </>
  )
}
