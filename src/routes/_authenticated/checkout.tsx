import { createFileRoute } from '@tanstack/react-router'
import { CheckoutPage } from '@/features/checkout/components/checkout-page'

/** Pagamento (private): the session guard of `_authenticated` sends visitors to login and back. */
export const Route = createFileRoute('/_authenticated/checkout')({
  head: () => ({ meta: [{ title: 'Pagamento | KURIO' }] }),
  component: CheckoutPage,
})
