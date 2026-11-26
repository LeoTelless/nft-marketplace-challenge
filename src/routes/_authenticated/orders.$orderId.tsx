import { createFileRoute, Link } from '@tanstack/react-router'
import { TriangleAlert } from 'lucide-react'
import { OrderCard } from '@/features/orders/components/order-card'
import { useOrder } from '@/features/orders/use-order'
import { StatusPage } from '@/shared/layout/status-page'
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
      <div className="container-page py-10 md:py-16">
        <div aria-busy="true" aria-label="Carregando pedido" className="mx-auto flex max-w-[578px] flex-col gap-4 bg-surface p-8">
          <Skeleton className="mx-auto size-20 rounded-full" />
          <Skeleton className="mx-auto h-5 w-2/3" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-[70px] w-full" />
        </div>
      </div>
    )
  }
  if (order.isError) {
    return (
      <StatusPage
        icon={TriangleAlert}
        tone="error"
        title="Não foi possível abrir o pedido"
        actions={
          <>
            <Button onClick={() => void order.refetch()} disabled={order.isFetching}>
              Tentar novamente
            </Button>
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
    <div className="container-page py-8 md:py-16">
      <OrderCard order={order.data} />
      {order.data.status === 'pending' && realtime !== 'connected' ? (
        <p role="status" className="mt-4 text-center text-sm text-text-muted">
          Reconectando ao servidor de atualizações… o estado do pedido será conferido ao reconectar.
        </p>
      ) : null}
    </div>
  )
}
