import { getRouteApi } from '@tanstack/react-router'
import { useCallback } from 'react'
import type { CatalogSearch } from './catalog-search'

const route = getRouteApi('/')

/**
 * Catalog state lives in the URL. `update` changes some params and, unless the page itself
 * is being changed, goes back to page 1 (a new filter, search or sort invalidates the page).
 * Each change is a history entry, so back/forward restore the previous state.
 */
export function useCatalogSearch() {
  const search = route.useSearch()
  const navigate = route.useNavigate()

  const update = useCallback(
    (patch: Partial<CatalogSearch>, options: { replace?: boolean } = {}) => {
      void navigate({
        search: (previous) => ({ ...previous, ...patch, page: patch.page ?? 1 }),
        replace: options.replace,
        resetScroll: false,
      })
    },
    [navigate],
  )

  const replaceAll = useCallback(
    (next: CatalogSearch) => void navigate({ search: next, resetScroll: false }),
    [navigate],
  )

  return { search, update, replaceAll }
}
