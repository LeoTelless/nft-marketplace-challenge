import { createFileRoute, Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { OrderCard, OrderCardSkeleton } from '@/features/orders/components/order-card'
import { useOrder } from '@/features/orders/use-order'
import { StatusPage } from '@/shared/layout/status-page'
import { isApiError } from '@/shared/api/api-error'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { useRealtimeStatus } from '@/shared/realtime/realtime-provider'
import { Button, buttonVariants } from '@/shared/ui/button'

/**
 * Pedido: pending → confirmed/rejected, driven by `order.updated` and reconciled by REST on
 * mount, refresh and reconnection. The confirmation and receipt render **only** for an order
 * the simulation reported as `confirmed`.
 */
export const Route = createFileRoute('/_authenticated/orders/$orderId')({
  head: () => ({ meta: [{ title: 'Pedido | KURIO' }] }),
  component: OrderPage,
})

function OrderPage() {
  const { orderId } = Route.useParams()
  const order = useOrder(orderId)
  const realtime = useRealtimeStatus()

  if (order.isPending) return <OrderCardSkeleton />
  if (order.isError) {
    // Missing or someone else's order: retrying cannot help.
    const final = isApiError(order.error) && (order.error.isNotFound || order.error.isForbidden)
    return (
      <StatusPage
        icon={TriangleAlert}
        tone="error"
        title="Não foi possível abrir o pedido"
        actions={
          <>
            {final ? null : (
              <Button onClick={() => void order.refetch()} disabled={order.isFetching}>
                Tentar novamente
              </Button>
            )}
            <Link to="/orders" className={buttonVariants({ variant: 'outline' })}>
              Meus pedidos
            </Link>
          </>
        }
      >
        <p role="alert">{apiErrorMessage(order.error)}</p>
      </StatusPage>
    )
  }

  return (
    <div className="container-page min-h-dvh py-8 md:pt-24 md:pb-16">
      <OrderCard order={order.data} />
      {order.data.status === 'pending' && realtime !== 'connected' ? (
        <p role="status" className="mt-4 text-center text-sm text-text-muted">
          Reconectando ao servidor de atualizações… o estado do pedido será conferido ao reconectar.
        </p>
      ) : null}
    </div>
  )
}
