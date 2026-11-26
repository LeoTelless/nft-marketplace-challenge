import { createFileRoute } from '@tanstack/react-router'
import { CartPage } from '@/features/cart/components/cart-page'

/** Carrinho de NFTs: public (visitor cart), persisted on the simulated server. */
export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Carrinho | KURIO' }] }),
  component: CartPage,
})
