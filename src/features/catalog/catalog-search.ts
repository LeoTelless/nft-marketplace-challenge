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

export const CATALOG_PAGE_SIZE = 12

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
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z
    .preprocess((value) => (typeof value === 'string' ? [value] : value), z.array(nftCategorySchema))
    .optional()
    .catch(undefined),
  minPrice: ethParam,
  maxPrice: ethParam,
  availability: nftAvailabilityFilterSchema.default('all').catch('all'),
  featured: z.boolean().optional().catch(undefined),
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
    search.featured,
  )
}

/** Search params with every filter (and the page) cleared; the sort is kept. */
export function clearedFilters(search: CatalogSearch): CatalogSearch {
  return { availability: 'all', sort: search.sort, page: 1 }
}
