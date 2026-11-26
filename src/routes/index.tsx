import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { CatalogCompactBar, CatalogSection } from '@/features/catalog/catalog-section'
import { CATALOG_SEARCH_DEFAULTS, catalogSearchSchema } from '@/features/catalog/catalog-search'
import { FeaturedBanner, HomeHero, HomeJournal, HomePromos } from '@/features/catalog/home-sections'

/**
 * Início: highlights, catalog (search, filters, sort, pagination as validated search params)
 * and the editorial blocks of the layout.
 */
export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams(CATALOG_SEARCH_DEFAULTS)] },
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex flex-col gap-10 pt-6 md:gap-16 md:pt-8 xl:gap-24">
      <div className="flex flex-col gap-4">
        <CatalogCompactBar />
        <HomeHero />
      </div>
      <CatalogSection sidebarExtra={<FeaturedBanner />} />
      <HomePromos />
      <HomeJournal />
    </div>
  )
}
