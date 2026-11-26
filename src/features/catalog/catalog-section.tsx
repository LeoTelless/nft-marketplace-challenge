import { Link } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, LoaderCircle, SearchX, TriangleAlert } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useFavorites } from '@/features/favorites/use-favorites'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { FilterIcon } from '@/shared/ui/icons'
import { getPageRange, Pagination, PaginationList, paginationItemClass } from '@/shared/ui/pagination'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet'
import { CatalogFilters } from './catalog-filters'
import { clearedFilters, hasActiveFilters, toListQuery, CATALOG_PAGE_SIZE, type CatalogSearch, type CatalogView } from './catalog-search'
import { CatalogSearchField } from './catalog-search-field'
import { CatalogSort, CatalogViews } from './catalog-toolbar'
import { NftCard, NftCardSkeleton } from './nft-card'
import { useNftList } from './queries'
import { useCatalogSearch } from './use-catalog-search'

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-3 md:gap-x-6 md:gap-y-12 xl:gap-x-8 xl:gap-y-[72px]'
/** Mobile composition: the right column is offset 32px (staggered grid of the mobile frame). */
const STAGGER = 'max-md:[&>*:nth-child(even)]:translate-y-8 max-md:pb-8'

/**
 * Search bar + filter button of the mobile frame (below `lg`). Rendered by the page above the
 * hero, as in the layout; it shares the URL state and the (deduplicated) list query.
 */
export function CatalogCompactBar({ className }: { className?: string }) {
  const { search, update, replaceAll } = useCatalogSearch()
  const list = useNftList(toListQuery(search))
  return (
    <div className={cn('container-page flex items-center gap-2 lg:hidden', className)}>
      <CatalogSearchField
        id="catalog-search-compact"
        value={search.q}
        onSearch={(q) => update({ q })}
        className="flex-1"
      />
      <FiltersSheet
        activeCount={countActive(search)}
        onClear={() => replaceAll(clearedFilters(search))}
        canClear={hasActiveFilters(search)}
        resultCount={list.data?.total}
      >
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <h3 className="text-lg leading-4 font-bold text-foreground">Ordenação</h3>
            <CatalogSort id="catalog-sort-sheet" value={search.sort} onChange={(sort) => update({ sort })} />
          </div>
          <CatalogFilters search={search} update={update} idPrefix="sheet" />
        </div>
      </FiltersSheet>
    </div>
  )
}

/**
 * Catalog: sidebar (search + filters; sheet below `lg`), the three views, sort, grid and
 * pagination, in the positions of the desktop frame. Everything is derived from the URL.
 */
export function CatalogSection({ sidebarExtra }: { sidebarExtra?: ReactNode }) {
  const { search, update, replaceAll } = useCatalogSearch()
  const list = useNftList(toListQuery(search))
  const favorites = useFavorites()
  const filtersActive = hasActiveFilters(search)
  const clear = () => replaceAll(clearedFilters(search))

  const data = list.data
  const isRefreshing = list.isFetching && list.isPlaceholderData
  const totalPages = data?.totalPages ?? 0

  // A page beyond the last one (e.g. data changed, or a hand-edited URL): go to the last page.
  useEffect(() => {
    if (data && !list.isPlaceholderData && data.totalPages > 0 && search.page > data.totalPages) {
      update({ page: data.totalPages }, { replace: true })
    }
  }, [data, list.isPlaceholderData, search.page, update])

  const filtersPanel = (idPrefix: string) => <CatalogFilters search={search} update={update} idPrefix={idPrefix} />

  return (
    <section id="catalogo" aria-labelledby="catalog-title" className="container-page scroll-mt-24 max-md:-mt-6">
      <h2 id="catalog-title" className="sr-only">
        Catálogo de NFTs
      </h2>

      <div className="flex gap-12">
        <aside aria-label="Filtros" className="hidden w-[260px] shrink-0 flex-col gap-6 lg:flex xl:w-[310px]">
          <div className="flex flex-col gap-10 bg-surface p-5">
            <div className="flex flex-col gap-3">
              <h3 className="text-lg leading-4 font-bold text-foreground">Buscar</h3>
              <CatalogSearchField
                id="catalog-search"
                value={search.q}
                onSearch={(q) => update({ q })}
                className="[&_input]:bg-surface-dark"
              />
            </div>
            {filtersPanel('sidebar')}
          </div>
          {sidebarExtra}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-x-6">
            <CatalogViews view={viewOf(search)} onChange={(view) => update(viewPatch(view))} />
            <div className="hidden lg:block">
              <CatalogSort id="catalog-sort" value={search.sort} onChange={(sort) => update({ sort })} />
            </div>
          </div>

          <ResultsSummary total={data?.total} loading={list.isPending} filtersActive={filtersActive} onClear={clear} />

          <div className="relative mt-4 md:mt-8">
            {isRefreshing ? (
              // Background update: overlay pill, outside the flow (no layout shift).
              <span
                className="absolute -top-3 right-0 z-10 inline-flex -translate-y-full items-center gap-1.5 rounded-full border border-line bg-surface-raised px-2.5 py-1 text-[13px] leading-4 text-brand-accent md:-top-4"
                data-testid="catalog-refreshing"
              >
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Atualizando…
              </span>
            ) : null}
            {list.isPending ? (
              <div aria-busy="true" aria-label="Carregando NFTs" className={cn(GRID, STAGGER)}>
                {Array.from({ length: CATALOG_PAGE_SIZE }, (_, i) => (
                  <NftCardSkeleton key={i} />
                ))}
              </div>
            ) : list.isError && !data ? (
              <CatalogError
                message={apiErrorMessage(list.error)}
                onRetry={() => void list.refetch()}
                retrying={list.isFetching}
              />
            ) : data && data.items.length === 0 ? (
              <CatalogEmpty filtersActive={filtersActive} onClear={clear} />
            ) : data ? (
              <>
                {list.isError ? (
                  <p role="alert" className="mb-4 flex items-center gap-2 text-sm text-coral">
                    <TriangleAlert className="size-4" aria-hidden="true" /> Não foi possível atualizar a lista.
                    <Button variant="link" size="xs" onClick={() => void list.refetch()}>
                      Tentar novamente
                    </Button>
                  </p>
                ) : null}
                <ul
                  data-testid="nft-list"
                  aria-busy={isRefreshing}
                  className={cn(GRID, STAGGER, 'transition-opacity', isRefreshing && 'opacity-60')}
                >
                  {data.items.map((nft, index) => (
                    <li key={nft.id}>
                      <NftCard
                        nft={nft}
                        priority={index < 2}
                        favorite={{
                          active: favorites.isFavorite(nft.id),
                          pending: favorites.pending(nft.id),
                          onToggle: () => favorites.toggle(nft.id, nft.name),
                        }}
                      />
                    </li>
                  ))}
                </ul>
                {totalPages > 1 ? <CatalogPagination page={search.page} totalPages={totalPages} /> : null}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

function countActive(search: CatalogSearch) {
  return (
    (search.category?.length ?? 0) +
    (search.minPrice || search.maxPrice ? 1 : 0) +
    (search.availability !== 'all' ? 1 : 0) +
    (search.featured || search.recent ? 1 : 0)
  )
}

function viewOf(search: CatalogSearch): CatalogView {
  return search.featured ? 'trending' : search.recent ? 'new' : 'all'
}

/** The three tabs are exclusive: each one sets its own filter and clears the other. */
function viewPatch(view: CatalogView): Partial<CatalogSearch> {
  return { featured: view === 'trending' ? true : undefined, recent: view === 'new' ? true : undefined }
}

function ResultsSummary({
  total,
  loading,
  filtersActive,
  onClear,
}: {
  total: number | undefined
  loading: boolean
  filtersActive: boolean
  onClear: () => void
}) {
  return (
    // Visible only with active filters, so the default view keeps the
    // layout of the frame; the count is always announced to screen readers.
    <div
      className={cn(
        filtersActive
          ? 'mt-3 flex min-h-7 flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-5 text-text-secondary'
          : 'sr-only',
      )}
    >
      {/* Polite live region: announces the result count after each search/filter. */}
      <p aria-live="polite" aria-atomic="true">
        {loading
          ? 'Carregando NFTs…'
          : total === undefined
            ? ''
            : `${total} ${total === 1 ? 'NFT encontrado' : 'NFTs encontrados'}`}
      </p>
      {filtersActive ? (
        <Button variant="link" size="xs" className="text-[13px]" onClick={onClear}>
          Limpar filtros
        </Button>
      ) : null}
    </div>
  )
}

function CatalogEmpty({ filtersActive, onClear }: { filtersActive: boolean; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 bg-surface px-6 py-16 text-center" data-testid="catalog-empty">
      <SearchX className="size-10 text-brand-accent" aria-hidden="true" />
      <h3 className="text-lg leading-6 font-bold">Nenhum NFT encontrado</h3>
      <p className="max-w-sm text-sm leading-6 text-text-secondary">
        {filtersActive
          ? 'Nenhum NFT corresponde à busca e aos filtros selecionados. Tente outros termos ou limpe os filtros.'
          : 'O catálogo está vazio no momento. Volte mais tarde para ver novos lançamentos.'}
      </p>
      {filtersActive ? <Button onClick={onClear}>Limpar filtros</Button> : null}
    </div>
  )
}

function CatalogError({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying: boolean }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 bg-surface px-6 py-16 text-center"
      data-testid="catalog-error"
    >
      <TriangleAlert className="size-10 text-coral" aria-hidden="true" />
      <h3 className="text-lg leading-6 font-bold">Não foi possível carregar o catálogo</h3>
      <p className="max-w-sm text-sm leading-6 text-text-secondary">{message}</p>
      <Button onClick={onRetry} disabled={retrying} aria-busy={retrying || undefined}>
        {retrying ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : null}
        Tentar novamente
      </Button>
    </div>
  )
}

/**
 * Page 1 is written as an explicit `undefined` (stripped from the URL) and compared with
 * `explicitUndefined`, so the router marks only the current page link as active.
 */
const PAGE_LINK_ACTIVE = { explicitUndefined: true } as const
const pageParam = (page: number) => (page === 1 ? undefined : page)

function CatalogPagination({ page, totalPages }: { page: number; totalPages: number }) {
  const scrollTop = () => document.getElementById('catalogo')?.scrollIntoView({ block: 'start' })
  return (
    <Pagination aria-label="Paginação do catálogo" className="mt-12 justify-end md:mt-[88px]">
      <PaginationList>
        {page > 1 ? (
          <li>
            <Link
              from="/"
              to="."
              search={(prev) => ({ ...prev, page: pageParam(page - 1) })}
              activeOptions={PAGE_LINK_ACTIVE}
              resetScroll={false}
              onClick={scrollTop}
              aria-label="Página anterior"
              className={paginationItemClass()}
            >
              <ChevronLeft className="size-[18px]" aria-hidden="true" />
            </Link>
          </li>
        ) : null}
        {getPageRange(page, totalPages).map((item, index) =>
          item === '…' ? (
            <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-text-secondary">
              …
            </li>
          ) : (
            <li key={item}>
              <Link
                from="/"
                to="."
                search={(prev) => ({ ...prev, page: pageParam(item) })}
                activeOptions={PAGE_LINK_ACTIVE}
                resetScroll={false}
                onClick={scrollTop}
                aria-label={`Página ${item}`}
                className={paginationItemClass({ current: item === page })}
              >
                {item}
              </Link>
            </li>
          ),
        )}
        {page < totalPages ? (
          <li>
            <Link
              from="/"
              to="."
              search={(prev) => ({ ...prev, page: pageParam(page + 1) })}
              activeOptions={PAGE_LINK_ACTIVE}
              resetScroll={false}
              onClick={scrollTop}
              aria-label="Próxima página"
              className={paginationItemClass()}
            >
              <ChevronRight className="size-[18px]" aria-hidden="true" />
            </Link>
          </li>
        ) : null}
      </PaginationList>
    </Pagination>
  )
}

function FiltersSheet({
  children,
  activeCount,
  canClear,
  onClear,
  resultCount,
}: {
  children: ReactNode
  activeCount: number
  canClear: boolean
  onClear: () => void
  resultCount: number | undefined
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={activeCount ? `Filtros (${activeCount} ativos)` : 'Filtros'}
          className="relative grid size-[45px] shrink-0 cursor-pointer place-content-center rounded-[14px] bg-linear-135 from-brand/45 to-brand text-ink"
        >
          <FilterIcon className="size-[22px]" />
          {activeCount ? (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 grid size-5 place-content-center rounded-full border-2 border-ink bg-foreground text-[10px] font-bold text-ink"
            >
              {activeCount}
            </span>
          ) : null}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>As alterações são aplicadas ao catálogo na hora.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-6 py-4">{children}</div>
        <SheetFooter className="flex-row border-t border-line px-6 py-4">
          <Button variant="secondary" className="flex-1" onClick={onClear} disabled={!canClear}>
            Limpar filtros
          </Button>
          <SheetClose asChild>
            <Button className="flex-1">
              {resultCount === undefined ? 'Ver resultados' : `Ver ${resultCount} resultados`}
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
