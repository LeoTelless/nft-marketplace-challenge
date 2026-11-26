import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Cart, CartItem, Nft } from '@/contracts'
import { queryKeys, type CartOwner } from '@/shared/api/query-keys'
import { notify } from '@/shared/feedback/notifications'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { cartApi } from './api'
import { applyServerCart, editionLimit, quantityInCart, useCartOwner } from './use-cart'

/** Business rule violated before reaching the API (quantity limits). */
export class CartLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CartLimitError'
  }
}

const CART_MUTATION_KEY = ['cart', 'mutation'] as const

interface Snapshot {
  owner: CartOwner
  previous: Cart | undefined
}

async function optimistic(queryClient: QueryClient, owner: CartOwner, update: (cart: Cart) => Cart): Promise<Snapshot> {
  const queryKey = queryKeys.cart.detail(owner)
  await queryClient.cancelQueries({ queryKey, exact: true })
  const previous = queryClient.getQueryData<Cart>(queryKey)
  if (previous) queryClient.setQueryData<Cart>(queryKey, update(previous))
  return { owner, previous }
}

function rollback(queryClient: QueryClient, snapshot: Snapshot | undefined) {
  if (snapshot?.previous) queryClient.setQueryData(queryKeys.cart.detail(snapshot.owner), snapshot.previous)
}

/** After any cart change: quotes are recomputed; the cart is refetched once nothing else is pending. */
function settle(queryClient: QueryClient, owner: CartOwner, failed: boolean) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.cart.quotes(owner) })
  if (failed || queryClient.isMutating({ mutationKey: CART_MUTATION_KEY }) <= 1) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.cart.detail(owner), exact: true })
  }
}

function requireOwner(owner: CartOwner | null): CartOwner {
  if (!owner) throw new CartLimitError('Aguarde a sessão carregar e tente novamente.')
  return owner
}

function errorMessage(error: unknown) {
  return error instanceof CartLimitError ? error.message : apiErrorMessage(error)
}

export interface AddToCartVariables {
  nft: Nft
  editionId: string
  quantity: number
}

/**
 * Adds units of an edition (detail page). Enforces the edition limit (availability and
 * per-order max, counting what is already in the cart) before calling the API; the line
 * appears optimistically and is rolled back if the API refuses (e.g. sold out meanwhile).
 */
export function useAddToCart() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: ({ nft, editionId, quantity }: AddToCartVariables) => cartApi.addItem({ nftId: nft.id, editionId, quantity }),
    // Validation runs here, before the optimistic update: throwing fails the mutation
    // without calling the API.
    onMutate: async ({ nft, editionId, quantity }) => {
      const cartOwner = requireOwner(owner)
      const edition = nft.editions.find((e) => e.id === editionId)
      if (!edition) throw new CartLimitError('Selecione uma edição.')
      if (!Number.isInteger(quantity) || quantity < 1) throw new CartLimitError('A quantidade deve ser um número inteiro positivo.')
      const limit = editionLimit(edition)
      if (limit === 0) throw new CartLimitError(`${nft.name} (${edition.name}) está esgotado.`)
      const current = quantityInCart(queryClient.getQueryData(queryKeys.cart.detail(cartOwner)), nft.id, editionId)
      if (current + quantity > limit) {
        throw new CartLimitError(
          `Você pode ter no máximo ${limit} unidade(s) de ${nft.name} (${edition.name}) no carrinho` +
            (current > 0 ? ` (já há ${current}).` : '.'),
        )
      }
      return optimistic(queryClient, cartOwner, (cart) => {
        const exists = cart.items.some((item) => item.nftId === nft.id && item.editionId === editionId)
        if (exists) {
          return {
            ...cart,
            items: cart.items.map((item) =>
              item.nftId === nft.id && item.editionId === editionId ? { ...item, quantity: item.quantity + quantity } : item,
            ),
          }
        }
        const line: CartItem = {
          id: `optimistic-${nft.id}-${editionId}`,
          nftId: nft.id,
          editionId,
          quantity,
          nftName: nft.name,
          editionName: edition.name,
          imageUrl: nft.images[0].url,
          unitPrice: edition.price,
          addedUnitPrice: edition.price,
          available: edition.available,
          maxPerOrder: edition.maxPerOrder,
        }
        return { ...cart, items: [...cart.items, line] }
      })
    },
    onSuccess: (cart, { nft, quantity }, snapshot) => {
      if (snapshot) applyServerCart(queryClient, snapshot.owner, cart)
      notify({ tone: 'success', title: `${quantity} × ${nft.name} adicionado ao carrinho.`, key: 'cart-add' })
    },
    onError: (error, { nft }, snapshot) => {
      rollback(queryClient, snapshot)
      notify({ tone: 'error', title: `Não foi possível adicionar ${nft.name}.`, description: errorMessage(error), key: 'cart-add' })
    },
    onSettled: (_data, error, _vars, snapshot) => {
      if (snapshot) settle(queryClient, snapshot.owner, Boolean(error))
    },
  })
}

/** Changes the quantity of a line (stepper). Optimistic, rolled back on failure. */
export function useUpdateCartItem() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: async ({ item, quantity }: { item: CartItem; quantity: number }) => {
      requireOwner(owner)
      if (!Number.isInteger(quantity) || quantity < 1) throw new CartLimitError('A quantidade deve ser um número inteiro positivo.')
      const limit = editionLimit(item)
      if (quantity > item.quantity && quantity > limit) {
        throw new CartLimitError(
          limit === 0
            ? `${item.nftName} (${item.editionName}) está esgotado.`
            : `Você pode ter no máximo ${limit} unidade(s) de ${item.nftName} (${item.editionName}).`,
        )
      }
      return cartApi.updateItem(item.id, { quantity })
    },
    onMutate: async ({ item, quantity }) => {
      if (!owner) return undefined
      return optimistic(queryClient, owner, (cart) => ({
        ...cart,
        items: cart.items.map((line) => (line.id === item.id ? { ...line, quantity } : line)),
      }))
    },
    onSuccess: (cart, _vars, snapshot) => {
      if (snapshot) applyServerCart(queryClient, snapshot.owner, cart)
    },
    onError: (error, { item }, snapshot) => {
      rollback(queryClient, snapshot)
      notify({ tone: 'error', title: `Não foi possível alterar a quantidade de ${item.nftName}.`, description: errorMessage(error), key: `cart-item-${item.id}` })
    },
    onSettled: (_data, error, _vars, snapshot) => {
      if (snapshot) settle(queryClient, snapshot.owner, Boolean(error))
    },
  })
}

/** Removes a line. Optimistic, rolled back on failure. */
export function useRemoveCartItem() {
  const queryClient = useQueryClient()
  const owner = useCartOwner()
  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: async ({ item }: { item: CartItem }) => {
      requireOwner(owner)
      return cartApi.removeItem(item.id)
    },
    onMutate: async ({ item }) => {
      if (!owner) return undefined
      return optimistic(queryClient, owner, (cart) => ({ ...cart, items: cart.items.filter((line) => line.id !== item.id) }))
    },
    onSuccess: (cart, { item }, snapshot) => {
      if (snapshot) applyServerCart(queryClient, snapshot.owner, cart)
      notify({ tone: 'info', title: `${item.nftName} removido do carrinho.`, key: `cart-item-${item.id}` })
    },
    onError: (error, { item }, snapshot) => {
      rollback(queryClient, snapshot)
      notify({ tone: 'error', title: `Não foi possível remover ${item.nftName}.`, description: errorMessage(error), key: `cart-item-${item.id}` })
    },
    onSettled: (_data, error, _vars, snapshot) => {
      if (snapshot) settle(queryClient, snapshot.owner, Boolean(error))
    },
  })
}
