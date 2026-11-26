import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Heart } from 'lucide-react'
import { AccountHeading, AccountLayout } from '@/features/account/account-layout'
import { nftDetailQueryOptions } from '@/features/catalog/queries'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useFavorites } from '@/features/favorites/use-favorites'
import { buttonVariants } from '@/shared/ui/button'

/** Lista de interesse (favorites). Removing is optimistic, with rollback and a notice on failure. */
export const Route = createFileRoute('/_authenticated/account/favorites')({
  head: () => ({ meta: [{ title: 'Lista de interesse | KURIO' }] }),
  component: FavoritesPage,
})

function FavoritesPage() {
  const favorites = useFavorites()
  const nfts = useQueries({ queries: favorites.ids.map((id) => nftDetailQueryOptions(id)) })

  return (
    <AccountLayout>
      <div className="flex flex-col gap-8">
        <AccountHeading title="Lista de interesse" description="NFTs que você favoritou para acompanhar preço e disponibilidade." />
        {favorites.isLoading ? (
          <div aria-busy="true" aria-label="Carregando favoritos" className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-7">
            {Array.from({ length: 3 }, (_, i) => (
              <NftCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.ids.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-md bg-surface p-6">
            <Heart className="size-8 text-brand-accent" aria-hidden="true" />
            <p>Você ainda não favoritou nenhum NFT.</p>
            <Link to="/" hash="catalogo" className={buttonVariants()}>
              Explorar o mercado
            </Link>
          </div>
        ) : (
          <ul aria-label="NFTs favoritos" className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-7">
            {favorites.ids.map((id, index) => {
              const nft = nfts[index]?.data
              return (
                <li key={id} aria-label={nft?.name ?? 'Carregando NFT'}>
                  {nft ? (
                    <NftCard
                      nft={nft}
                      headingLevel={2}
                      imageSizes="(min-width: 768px) 260px, 46vw"
                      favorite={{
                        active: favorites.isFavorite(id),
                        pending: favorites.pending(id),
                        onToggle: () => favorites.toggle(id, nft.name),
                      }}
                    />
                  ) : (
                    <NftCardSkeleton />
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </AccountLayout>
  )
}
