import { createFileRoute, Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { OrderCard } from '@/features/orders/components/order-card'
import { useOrder } from '@/features/orders/use-order'
import { StatusPage } from '@/shared/layout/status-page'
import { isApiError } from '@/shared/api/api-error'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { useRealtimeStatus } from '@/shared/realtime/realtime-provider'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

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

  if (order.isPending) {
    return (
      // Same box as the card (header, meta, two lines, totals, action) and a viewport-tall page,
      // so the footer never moves when the order arrives (CLS).
      <div className="container-page min-h-dvh py-8 md:py-16">
        <div
          aria-busy="true"
          aria-label="Carregando pedido"
          className="mx-auto flex max-w-[578px] flex-col gap-4 border-b-[10px] border-surface-raised bg-surface px-6 pt-6 pb-8 md:px-11"
        >
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="mx-auto h-5 w-2/3" />
          <Skeleton className="h-[60px] w-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-[70px] w-full" />
          <Skeleton className="h-[70px] w-full" />
          <Skeleton className="ml-auto h-[110px] w-full max-w-[321px]" />
          <Skeleton className="mx-auto h-[46px] w-48" />
        </div>
      </div>
    )
  }
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
    <div className="container-page min-h-dvh py-8 md:py-16">
      <OrderCard order={order.data} />
      {order.data.status === 'pending' && realtime !== 'connected' ? (
        <p role="status" className="mt-4 text-center text-sm text-text-muted">
          Reconectando ao servidor de atualizações… o estado do pedido será conferido ao reconectar.
        </p>
      ) : null}
    </div>
  )
}
