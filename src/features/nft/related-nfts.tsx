import type { Nft } from '@/contracts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useNftList } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/use-favorites'

const RELATED_COUNT = 5

/** "Mais desta coleção": other NFTs of the same category (horizontal scroll below `lg`). */
export function RelatedNfts({ nft }: { nft: Nft }) {
  const list = useNftList({ category: [nft.category], sort: 'newest', page: 1, pageSize: RELATED_COUNT + 1 })
  const favorites = useFavorites()
  const items = list.data?.items.filter((item) => item.id !== nft.id).slice(0, RELATED_COUNT)

  if (list.isError || (items && items.length === 0)) return null

  const row =
    'flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none md:gap-6 lg:grid lg:grid-cols-5 lg:gap-7 lg:overflow-visible'
  const cell = 'w-[175px] shrink-0 snap-start md:w-[220px] lg:w-auto'
  return (
    <section aria-labelledby="related-title" className="container-page mt-16 md:mt-24">
      <h2
        id="related-title"
        className="border-b border-brand/30 pb-3 text-[17px] leading-4 font-bold text-brand-accent"
      >
        Mais desta coleção
      </h2>
      {items ? (
        <ul className={`${row} mt-8`}>
          {items.map((item) => (
            <li key={item.id} className={cell}>
              <NftCard
                nft={item}
                imageSizes="(min-width: 1024px) 220px, 175px"
                favorite={{
                  active: favorites.isFavorite(item.id),
                  pending: favorites.pending(item.id),
                  onToggle: () => favorites.toggle(item.id, item.name),
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div aria-busy="true" aria-label="Carregando NFTs relacionados" className={`${row} mt-8`}>
          {Array.from({ length: RELATED_COUNT }, (_, i) => (
            <NftCardSkeleton key={i} className={cell} />
          ))}
        </div>
      )}
    </section>
  )
}
