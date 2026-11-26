import { z } from 'zod'
import {
  nftAvailabilityFilterSchema,
  nftCategorySchema,
  nftSortSchema,
  type NftCategory,
  type NftListQuery,
  type NftSort,
} from '@/contracts'
import { isEthAmount } from '@/shared/lib/eth'

/** 3×3 grid of the desktop frame (48 NFTs → 6 pages). */
export const CATALOG_PAGE_SIZE = 9

/** Portuguese labels of the API categories ("Coleções" in the layout), in alphabetical order. */
export const CATEGORY_LABELS: Record<NftCategory, string> = {
  art: 'Arte digital',
  collectibles: 'Colecionáveis',
  sports: 'Esportes',
  photography: 'Fotografia',
  gaming: 'Jogos',
  music: 'Música',
}
export const CATEGORIES_ALPHABETICAL = (Object.keys(CATEGORY_LABELS) as NftCategory[]).sort((a, b) =>
  CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b], 'pt-BR'),
)

export const SORT_OPTIONS: ReadonlyArray<{ value: NftSort; label: string }> = [
  { value: 'newest', label: 'Listados recentemente' },
  { value: 'name_asc', label: 'Nome: A → Z' },
  { value: 'name_desc', label: 'Nome: Z → A' },
  { value: 'price_asc', label: 'Menor preço' },
  { value: 'price_desc', label: 'Maior preço' },
]

export type CatalogView = 'all' | 'new' | 'trending'

/** Tabs of the layout. "Novos lançamentos" = `recent` filter, "Em alta" = `featured` filter. */
export const CATALOG_VIEWS: ReadonlyArray<{ value: CatalogView; label: string }> = [
  { value: 'all', label: 'Todos os NFTs' },
  { value: 'new', label: 'Novos lançamentos' },
  { value: 'trending', label: 'Em alta' },
]

export const AVAILABILITY_LABELS = {
  all: 'Todos',
  available: 'Disponíveis',
  sold_out: 'Esgotados',
} as const

const ethParam = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim().replace(',', '.'))
  .refine(isEthAmount)
  .optional()
  .catch(undefined)

/**
 * Search params of the catalog (`/`). Every value is validated and invalid ones fall back to
 * the default (`.catch`), so a hand-edited or outdated URL never breaks the page.
 * Defaults are stripped from the URL (see the route), keeping links short and canonical.
 */
export const catalogSearchSchema = z.object({
  // "true"/"false" come back from the URL as booleans (see `shared/lib/search-serialization.ts`, registered in `app.tsx`).
  q: z
    .union([z.string(), z.number(), z.boolean()])
    .transform((value) => String(value).trim())
    .pipe(z.string().max(100))
    .optional()
    .catch(undefined),
  category: z
    // Readable URL: `?category=art,music` (an array is also accepted).
    .preprocess(
      (value) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value),
      z.array(nftCategorySchema),
    )
    .optional()
    .catch(undefined),
  minPrice: ethParam,
  maxPrice: ethParam,
  availability: nftAvailabilityFilterSchema.default('all').catch('all'),
  featured: z.boolean().optional().catch(undefined),
  /** "Novos lançamentos" tab (listed in the last 30 days). Exclusive with `featured` in the tabs. */
  recent: z.boolean().optional().catch(undefined),
  sort: nftSortSchema.default('newest').catch('newest'),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type CatalogSearch = z.infer<typeof catalogSearchSchema>

export const CATALOG_SEARCH_DEFAULTS = {
  availability: 'all',
  sort: 'newest',
  page: 1,
} as const satisfies Partial<CatalogSearch>

/** The API query is derived from the URL only: same URL, same query key, same request. */
export function toListQuery(search: CatalogSearch): NftListQuery {
  return {
    q: search.q || undefined,
    // Sorted so `?category=a,b` and `?category=b,a` share one cache entry.
    category: search.category?.length ? [...search.category].sort() : undefined,
    minPrice: search.minPrice,
    maxPrice: search.maxPrice,
    availability: search.availability,
    featured: search.featured,
    recent: search.recent,
    sort: search.sort,
    page: search.page,
    pageSize: CATALOG_PAGE_SIZE,
  }
}

export function hasActiveFilters(search: CatalogSearch): boolean {
  return Boolean(
    search.q ||
    search.category?.length ||
    search.minPrice ||
    search.maxPrice ||
    search.availability !== 'all' ||
    search.featured ||
    search.recent,
  )
}

/** Search params with every filter (and the page) cleared; the sort is kept. */
export function clearedFilters(search: CatalogSearch): CatalogSearch {
  return { availability: 'all', sort: search.sort, page: 1 }
}
