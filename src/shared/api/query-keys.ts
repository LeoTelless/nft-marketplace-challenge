import type { NftListQuery, QuoteRequest } from '@/contracts'

/**
 * Query key factory.
 *
 * - Public data (catalog) is keyed by its parameters only.
 * - Every private key starts with `['user', userId]`, so data of one user can never be
 *   served to another one, and logout/user switch can drop all of it at once with
 *   `removeQueries({ queryKey: queryKeys.user.all(userId) })` (or `queryClient.clear()`).
 * - The cart is private too: keyed by the user, or by the visitor cart id.
 */
export const queryKeys = {
  session: (token: string | null) => ['session', token ?? 'anonymous'] as const,

  nfts: {
    all: () => ['nfts'] as const,
    lists: () => ['nfts', 'list'] as const,
    list: (query: NftListQuery) => ['nfts', 'list', query] as const,
    details: () => ['nfts', 'detail'] as const,
    detail: (id: string) => ['nfts', 'detail', id] as const,
  },

  user: {
    all: (userId: string) => ['user', userId] as const,
    favorites: (userId: string) => ['user', userId, 'favorites'] as const,
    profile: (userId: string) => ['user', userId, 'profile'] as const,
    wallets: (userId: string) => ['user', userId, 'wallets'] as const,
    orders: (userId: string) => ['user', userId, 'orders'] as const,
    order: (userId: string, orderId: string) => ['user', userId, 'orders', orderId] as const,
  },

  cart: {
    all: () => ['cart'] as const,
    /** `owner` is the user id, or the visitor cart id when anonymous. */
    detail: (owner: CartOwner) => ['cart', cartOwnerKey(owner)] as const,
    quotes: (owner: CartOwner) => ['cart', cartOwnerKey(owner), 'quote'] as const,
    quote: (owner: CartOwner, request: QuoteRequest) => ['cart', cartOwnerKey(owner), 'quote', request] as const,
  },
} as const

export type CartOwner = { userId: string } | { guestCartId: string }

function cartOwnerKey(owner: CartOwner): string {
  return 'userId' in owner ? `user:${owner.userId}` : `guest:${owner.guestCartId}`
}
