import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import type { Network, Quote, QuoteRequest } from '@/contracts'
import { isApiError } from '@/shared/api/api-error'
import { queryKeys, type CartOwner } from '@/shared/api/query-keys'
import { notify } from '@/shared/feedback/notifications'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { userStorage } from '@/shared/session/user-storage'
import { cartApi } from './api'
import { cartOwnerId, useCartOwner } from './use-cart'

export const DEFAULT_NETWORK: Network = 'ethereum'

// ---------------------------------------------------------------- applied coupon

/**
 * The applied coupon is client state (the quote request carries it). Kept per cart owner in
 * `sessionStorage` (survives refresh and the cart → checkout navigation, wiped on logout).
 */
const couponListeners = new Set<() => void>()
const COUPON_ENTRY = 'coupon'

const couponStore = {
  get(ownerId: string): string | null {
    return userStorage.get<string>(ownerId, COUPON_ENTRY)
  },
  set(ownerId: string, code: string | null) {
    if (code) userStorage.set(ownerId, COUPON_ENTRY, code)
    else userStorage.remove(ownerId, COUPON_ENTRY)
    for (const listener of couponListeners) listener()
  },
  subscribe(listener: () => void) {
    couponListeners.add(listener)
    return () => couponListeners.delete(listener)
  },
}

function useAppliedCoupon(owner: CartOwner | null): string | null {
  const ownerId = owner ? cartOwnerId(owner) : null
  const get = useCallback(() => (ownerId ? couponStore.get(ownerId) : null), [ownerId])
  return useSyncExternalStore(couponStore.subscribe, get, get)
}

function isCouponError(error: unknown) {
  return isApiError(error) && (error.code === 'coupon_invalid' || error.code === 'coupon_expired')
}

// ---------------------------------------------------------------- quote

/**
 * Authoritative totals for the current cart (`POST /quotes`): subtotal, discount, network fee
 * and total are always shown from here, never recomputed in the client.
 * Invalidated by cart mutations and by `nft.updated` of an NFT in the cart; while refetching,
 * the previous quote stays visible but `isUpdating` is true (checkout must not confirm it).
 */
export function useQuote(network: Network = DEFAULT_NETWORK) {
  const owner = useCartOwner()
  const couponCode = useAppliedCoupon(owner)
  const request: QuoteRequest = couponCode ? { network, couponCode } : { network }
  const query = useQuery({
    queryKey: owner ? queryKeys.cart.quote(owner, request) : (['cart', 'unknown', 'quote'] as const),
    queryFn: ({ signal }) => cartApi.quote(request, { signal }),
    enabled: owner !== null,
    placeholderData: keepPreviousData,
    // The quote is short-lived and server-computed: always re-validate when it is needed again.
    staleTime: 0,
  })

  // A coupon that stopped being valid (e.g. expired since it was applied) is dropped, loudly.
  const couponError = couponCode && isCouponError(query.error) ? query.error : null
  useEffect(() => {
    if (!owner || !couponError) return
    couponStore.set(cartOwnerId(owner), null)
    notify({ tone: 'warning', title: `O cupom ${couponCode} foi removido.`, description: apiErrorMessage(couponError), key: 'coupon' })
  }, [owner, couponError, couponCode])

  return {
    ...query,
    owner,
    couponCode,
    network,
    /** Showing a previous quote while a new one is computed. */
    isUpdating: query.isFetching || query.isPlaceholderData,
  }
}

/** Fetches a brand-new quote now (checkout revalidation before confirming). */
export function useRevalidateQuote() {
  const queryClient = useQueryClient()
  return useCallback(
    async (owner: CartOwner, request: QuoteRequest): Promise<Quote> => {
      const queryKey = queryKeys.cart.quote(owner, request)
      await queryClient.cancelQueries({ queryKey })
      return queryClient.fetchQuery({ queryKey, queryFn: ({ signal }) => cartApi.quote(request, { signal }), staleTime: 0 })
    },
    [queryClient],
  )
}

/** Seeds the quote cache with a quote returned by the API (e.g. `details.quote` of a 409). */
export function putQuote(queryClient: ReturnType<typeof useQueryClient>, owner: CartOwner, quote: Quote, couponCode: string | null) {
  const request: QuoteRequest = couponCode ? { network: quote.network, couponCode } : { network: quote.network }
  queryClient.setQueryData(queryKeys.cart.quote(owner, request), quote)
}

/**
 * Apply/remove a coupon. Applying validates it with the API first (`coupon_invalid` and
 * `coupon_expired` come back as the mutation error, with distinct messages via
 * `apiErrorMessage`); only a valid coupon is stored.
 */
export function useCoupon(network: Network = DEFAULT_NETWORK) {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  const applied = useAppliedCoupon(owner)

  const apply = useMutation({
    mutationKey: ['cart', 'coupon'],
    mutationFn: async (code: string) => {
      if (!owner) throw new Error('Aguarde a sessão carregar e tente novamente.')
      const couponCode = code.trim().toUpperCase()
      const quote = await cartApi.quote({ network, couponCode })
      return { owner, couponCode, quote }
    },
    onSuccess: ({ owner: cartOwner, couponCode, quote }) => {
      putQuote(queryClient, cartOwner, quote, couponCode)
      couponStore.set(cartOwnerId(cartOwner), couponCode)
      notify({ tone: 'success', title: `Cupom ${couponCode} aplicado.`, key: 'coupon' })
    },
  })

  const remove = useCallback(() => {
    if (!owner) return
    couponStore.set(cartOwnerId(owner), null)
    apply.reset()
    notify({ tone: 'info', title: 'Cupom removido.', key: 'coupon' })
  }, [owner, apply])

  return {
    applied,
    apply: apply.mutate,
    applyAsync: apply.mutateAsync,
    isApplying: apply.isPending,
    /** pt-BR message of the last failed attempt (invalid vs expired are distinct). */
    error: apply.error ? apiErrorMessage(apply.error) : null,
    errorCode: isApiError(apply.error) ? apply.error.code : null,
    remove,
  }
}
