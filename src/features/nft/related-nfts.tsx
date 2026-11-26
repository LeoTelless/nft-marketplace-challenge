import { useCallback, useEffect, useRef, useState } from 'react'
import type { Nft } from '@/contracts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useNftList } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/use-favorites'
import { cn } from '@/shared/lib/utils'

/** Up to 15 others of the same collection: 3 pages of 5 on desktop, as the carousel of the frame. */
const RELATED_MAX = 15

const ROW = 'scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:gap-6 lg:gap-7'
const CELL = 'w-[175px] shrink-0 snap-start md:w-[220px] lg:w-[calc((100%-4*28px)/5)]'

/**
 * "Mais desta coleção": horizontal carousel (native scroll + snap, so touch, trackpad and
 * keyboard scrolling work) with the page dots of the layout below it.
 */
export function RelatedNfts({ nft }: { nft: Nft }) {
  const list = useNftList({ category: [nft.category], sort: 'newest', page: 1, pageSize: RELATED_MAX + 1 })
  const favorites = useFavorites()
  const items = list.data?.items.filter((item) => item.id !== nft.id).slice(0, RELATED_MAX)
  const scroller = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  const measure = useCallback(() => {
    const element = scroller.current
    if (!element) return
    const total = Math.max(1, Math.ceil(element.scrollWidth / element.clientWidth - 0.05))
    const atEnd = element.scrollLeft >= element.scrollWidth - element.clientWidth - 2
    setPages(total)
    setPage(atEnd ? total - 1 : Math.min(total - 1, Math.round(element.scrollLeft / element.clientWidth)))
  }, [])

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure, items?.length])

  if (list.isError || (items && items.length === 0)) return null

  return (
    <section aria-labelledby="related-title" className="container-page mt-16 md:mt-24">
      <h2
        id="related-title"
        className="border-b border-brand/30 pb-3 text-[17px] leading-4 font-bold text-brand-accent"
      >
        Mais desta coleção
      </h2>
      {items ? (
        <>
          <ul ref={scroller} onScroll={measure} className={cn(ROW, 'mt-8')} aria-label="NFTs da mesma coleção">
            {items.map((item) => (
              <li key={item.id} className={CELL}>
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
          {/* The dots row always keeps its height (no shift when the page count is known). */}
          {/* Frame: 12px dots 32px below the cards, 8px apart; the 24px hit areas sit side by side. */}
          <div className="mt-[18px] h-6">
            {pages > 1 ? (
              <div role="group" aria-label="Páginas do carrossel" className="flex justify-center">
                {Array.from({ length: pages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Página ${index + 1} de ${pages}`}
                    aria-pressed={index === page}
                    onClick={() => {
                      const element = scroller.current
                      element?.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
                    }}
                    className="grid size-6 cursor-pointer place-content-center"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'block size-3 rounded-full border-[1.3px] border-brand',
                        index === page ? 'bg-brand' : 'bg-transparent',
                      )}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div aria-busy="true" aria-label="Carregando NFTs relacionados" className={cn(ROW, 'mt-8')}>
          {Array.from({ length: 5 }, (_, i) => (
            <NftCardSkeleton key={i} className={CELL} />
          ))}
        </div>
      )}
    </section>
  )
}
