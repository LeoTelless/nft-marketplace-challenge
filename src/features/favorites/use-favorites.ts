import { useMutation, useMutationState, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'
import type { Favorites } from '@/contracts'
import { useSession } from '@/features/auth/session'
import { queryKeys } from '@/shared/api/query-keys'
import { notify } from '@/shared/feedback/notifications'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { favoritesApi } from './api'

const TOGGLE_KEY = ['favorites', 'toggle'] as const

interface ToggleVariables {
  userId: string
  nftId: string
  /** Desired state after the toggle. */
  favorite: boolean
  /** For the feedback message. */
  nftName?: string
}

function withFavorite(data: Favorites | undefined, nftId: string, favorite: boolean): Favorites {
  const ids = (data?.nftIds ?? []).filter((id) => id !== nftId)
  return { nftIds: favorite ? [...ids, nftId] : ids }
}

/**
 * Optimistic favorite toggle. The cache flips immediately; on failure only *this* NFT is
 * reverted (other toggles in flight are kept) and an assertive notice explains it.
 * The server answer then becomes the truth (invalidation once nothing else is pending).
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: TOGGLE_KEY,
    mutationFn: ({ nftId, favorite }: ToggleVariables) =>
      favorite ? favoritesApi.add(nftId) : favoritesApi.remove(nftId),
    onMutate: async ({ userId, nftId, favorite }) => {
      const queryKey = queryKeys.user.favorites(userId)
      await queryClient.cancelQueries({ queryKey })
      queryClient.setQueryData<Favorites>(queryKey, (data) => withFavorite(data, nftId, favorite))
    },
    onError: (error, { userId, nftId, favorite, nftName }) => {
      queryClient.setQueryData<Favorites>(queryKeys.user.favorites(userId), (data) => withFavorite(data, nftId, !favorite))
      notify({
        tone: 'error',
        title: favorite ? 'Não foi possível favoritar.' : 'Não foi possível remover dos favoritos.',
        description: `${nftName ? `${nftName}: ` : ''}${apiErrorMessage(error)}`,
        key: `favorite-${nftId}`,
      })
    },
    onSettled: (_data, _error, { userId }) => {
      if (queryClient.isMutating({ mutationKey: TOGGLE_KEY }) <= 1) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.user.favorites(userId) })
      }
    },
  })
}

export interface FavoritesApi {
  /** Favorite ids of the current user (empty for visitors or while loading). */
  ids: readonly string[]
  isFavorite(nftId: string): boolean
  /** True while a toggle of this NFT is in flight (the button should be `aria-busy`). */
  pending(nftId: string): boolean
  /** Visitors are sent to login (and come back here afterwards). */
  toggle(nftId: string, nftName?: string): void
  isAuthenticated: boolean
  isLoading: boolean
}

/**
 * Simple API for cards and the detail page:
 * `const favorites = useFavorites(); favorites.isFavorite(id); favorites.toggle(id, name)`.
 */
export function useFavorites(): FavoritesApi {
  const { user, isAuthenticated } = useSession()
  const userId = user?.id ?? null
  const navigate = useNavigate()
  const router = useRouter()
  const query = useQuery({
    queryKey: queryKeys.user.favorites(userId ?? ''),
    queryFn: ({ signal }) => favoritesApi.list({ signal }),
    enabled: userId !== null,
  })
  const mutation = useToggleFavorite()
  const pendingIds = useMutationState({
    filters: { mutationKey: TOGGLE_KEY, status: 'pending' },
    select: (m) => (m.state.variables as ToggleVariables | undefined)?.nftId,
  })

  const ids = useMemo(() => (userId ? (query.data?.nftIds ?? []) : []), [userId, query.data])
  const isFavorite = useCallback((nftId: string) => ids.includes(nftId), [ids])
  const pending = useCallback((nftId: string) => pendingIds.includes(nftId), [pendingIds])

  const toggle = useCallback(
    (nftId: string, nftName?: string) => {
      if (!userId) {
        void navigate({ to: '/login', search: { redirect: router.state.location.href, reason: 'required' } })
        return
      }
      if (pendingIds.includes(nftId)) return
      mutation.mutate({ userId, nftId, favorite: !ids.includes(nftId), nftName })
    },
    [userId, pendingIds, ids, mutation, navigate, router],
  )

  return { ids, isFavorite, pending, toggle, isAuthenticated, isLoading: userId !== null && query.isPending }
}
