import { useQuery, type QueryClient } from '@tanstack/react-query'
import type { Cart, CartItem, Edition, Nft } from '@/contracts'
import { useGuestCartId, useSession } from '@/features/auth/session'
import { queryKeys, type CartOwner } from '@/shared/api/query-keys'
import { compareEth } from '@/shared/lib/eth'
import { cartApi } from './api'

/**
 * Whose cart is shown: the account cart when authenticated, the visitor cart otherwise.
 * `null` while a stored session is still being validated (avoids showing the visitor cart
 * for a moment and then swapping it).
 */
export function useCartOwner(): CartOwner | null {
  const { user, status } = useSession()
  const guestCartId = useGuestCartId()
  if (status === 'authenticated' && user) return { userId: user.id }
  if (status === 'anonymous') return { guestCartId }
  return null
}

export function cartOwnerId(owner: CartOwner): string {
  return 'userId' in owner ? owner.userId : owner.guestCartId
}

function cartQueryOptions(owner: CartOwner | null) {
  return {
    queryKey: owner ? queryKeys.cart.detail(owner) : (['cart', 'unknown'] as const),
    queryFn: ({ signal }: { signal: AbortSignal }) => cartApi.get({ signal }),
    enabled: owner !== null,
  }
}

/**
 * Server cart (survives refresh: visitor id in localStorage, account cart on the server).
 * `sessionError`: the stored session could not be validated (network/5xx after the retries), so
 * the owner, and therefore the cart, is unknown; `retrySession` asks `GET /session` again.
 */
export function useCart() {
  const session = useSession()
  const owner = useCartOwner()
  return {
    owner,
    sessionError: session.status === 'error' ? session.error : null,
    retrySession: session.retry,
    retryingSession: session.retrying,
    ...useQuery(cartQueryOptions(owner)),
  }
}

/** Total units in the cart, for the header badge. 0 while unknown. */
export function useCartCount(): number {
  const owner = useCartOwner()
  const { data } = useQuery({
    ...cartQueryOptions(owner),
    select: (cart: Cart) => cart.items.reduce((sum, item) => sum + item.quantity, 0),
  })
  return data ?? 0
}

/**
 * Writes a server cart into the cache unless a newer version is already there
 * (responses of concurrent mutations may arrive out of order).
 */
export function applyServerCart(queryClient: QueryClient, owner: CartOwner, cart: Cart) {
  queryClient.setQueryData<Cart>(queryKeys.cart.detail(owner), (current) =>
    current && current.version > cart.version ? current : cart,
  )
}

/** Max units of an edition one order may contain right now. */
export function editionLimit(edition: Pick<Edition, 'available' | 'maxPerOrder'>): number {
  return Math.max(0, Math.min(edition.available, edition.maxPerOrder))
}

export function quantityInCart(cart: Cart | undefined, nftId: string, editionId: string): number {
  return cart?.items.find((item) => item.nftId === nftId && item.editionId === editionId)?.quantity ?? 0
}

/** How many more units of this edition can still be added (detail page stepper max). */
export function remainingForEdition(cart: Cart | undefined, nft: Nft, editionId: string): number {
  const edition = nft.editions.find((e) => e.id === editionId)
  if (!edition) return 0
  return Math.max(0, editionLimit(edition) - quantityInCart(cart, nft.id, editionId))
}

export interface CartItemState {
  /** Stepper bounds: quantity can go from 1 to `max`. */
  max: number
  soldOut: boolean
  /** More units in the cart than are available now: must be reduced before checkout. */
  exceedsAvailability: boolean
  /** Price differs from the price when the item was added. */
  priceChanged: boolean
  priceDirection: 'up' | 'down' | null
}

export function describeCartItem(item: CartItem): CartItemState {
  const comparison = compareEth(item.unitPrice, item.addedUnitPrice)
  return {
    max: Math.max(1, editionLimit(item)),
    soldOut: item.available === 0,
    exceedsAvailability: item.quantity > item.available,
    priceChanged: comparison !== 0,
    priceDirection: comparison > 0 ? 'up' : comparison < 0 ? 'down' : null,
  }
}
