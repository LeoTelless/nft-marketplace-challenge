import { useQueries } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { catalogApi } from '@/features/catalog/api'
import { useFavorites } from '@/features/favorites/use-favorites'
import { queryKeys } from '@/shared/api/query-keys'
import { Button } from '@/shared/ui/button'

/** Provisional favorites screen (flow skeleton). */
export const Route = createFileRoute('/_authenticated/account/favorites')({
  head: () => ({ meta: [{ title: 'Favoritos | KURIO' }] }),
  component: FavoritesPage,
})

function FavoritesPage() {
  const favorites = useFavorites()
  const nfts = useQueries({
    queries: favorites.ids.map((id) => ({
      queryKey: queryKeys.nfts.detail(id),
      queryFn: ({ signal }: { signal: AbortSignal }) => catalogApi.detail(id, { signal }),
    })),
  })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Favoritos</h1>
      {favorites.isLoading ? (
        <p aria-busy="true">Carregando favoritos…</p>
      ) : favorites.ids.length === 0 ? (
        <p>
          Você ainda não favoritou nenhum NFT.{' '}
          <Link to="/" className="underline">
            Explorar o mercado
          </Link>
        </p>
      ) : (
        <ul aria-label="NFTs favoritos" className="flex flex-col gap-2">
          {favorites.ids.map((id, index) => {
            const name = nfts[index]?.data?.name ?? id
            return (
              <li key={id} aria-label={name} className="flex items-center justify-between gap-2 rounded-md border p-3">
                <span>{name}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  aria-pressed={favorites.isFavorite(id)}
                  aria-busy={favorites.pending(id) || undefined}
                  onClick={() => favorites.toggle(id, name)}
                >
                  Remover {name} dos favoritos
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
