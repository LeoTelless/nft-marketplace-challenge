import { createFileRoute, Link } from '@tanstack/react-router'
import { CircleCheck, CircleX, Hourglass, ShoppingCart, TriangleAlert } from 'lucide-react'
import type { Order } from '@/contracts'
import { AccountHeading, AccountLayout } from '@/features/account/account-layout'
import { formatOrderDate } from '@/features/orders/format'
import { useOrders } from '@/features/orders/use-order'
import { formatEth } from '@/shared/lib/eth'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

/** Atividade: the user's orders (most recent first), each linking to its state/receipt. */
export const Route = createFileRoute('/_authenticated/orders/')({
  head: () => ({ meta: [{ title: 'Meus pedidos | KURIO' }] }),
  component: OrdersPage,
})

const STATUS = {
  pending: { label: 'Pendente', icon: Hourglass, className: 'border-amber/60 text-amber' },
  confirmed: { label: 'Confirmado', icon: CircleCheck, className: 'border-success/70 text-success' },
  rejected: { label: 'Recusado', icon: CircleX, className: 'border-coral/70 text-coral' },
} as const

function OrdersPage() {
  const orders = useOrders()
  return (
    <AccountLayout>
      <div className="flex flex-col gap-8">
        <AccountHeading
          title="Atividade"
          description={
            <>
              Seus pedidos, do mais recente ao mais antigo.
              {orders.isFetching && !orders.isPending ? <span className="ml-2 text-xs text-text-muted">Atualizando…</span> : null}
            </>
          }
        />
        {orders.isPending ? (
          <div aria-busy="true" aria-label="Carregando pedidos" className="flex flex-col gap-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-[72px] w-full" />
            ))}
          </div>
        ) : orders.isError ? (
          <div role="alert" className="flex flex-col items-start gap-3 rounded-md bg-surface p-6">
            <TriangleAlert className="size-6 text-coral" aria-hidden="true" />
            <p>{apiErrorMessage(orders.error)}</p>
            <Button onClick={() => void orders.refetch()}>Tentar novamente</Button>
          </div>
        ) : orders.data.items.length === 0 ? (
          <div className="flex flex-col items-start gap-4 rounded-md bg-surface p-6">
            <ShoppingCart className="size-8 text-brand-accent" aria-hidden="true" />
            <p>Você ainda não fez nenhum pedido.</p>
            <Link to="/" hash="catalogo" className={buttonVariants()}>
              Explorar o mercado
            </Link>
          </div>
        ) : (
          <ul aria-label="Pedidos" className="flex flex-col gap-3">
            {orders.data.items.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
        )}
      </div>
    </AccountLayout>
  )
}

function OrderRow({ order }: { order: Order }) {
  const status = STATUS[order.status]
  const Icon = status.icon
  const units = order.receipt.lines.reduce((sum, line) => sum + line.quantity, 0)
  return (
    <li className="relative flex flex-wrap items-center gap-x-6 gap-y-2 bg-surface px-4 py-4 md:px-6">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          to="/orders/$orderId"
          params={{ orderId: order.id }}
          className="font-bold after:absolute after:inset-0 hover:text-brand-accent"
        >
          Pedido {order.id}
        </Link>
        <span className="text-sm text-text-muted">
          {formatOrderDate(order.createdAt)} · {units} {units === 1 ? 'item' : 'itens'} · {order.receipt.lines.map((l) => l.nftName).join(', ')}
        </span>
      </div>
      <span className="text-lg font-bold text-brand-accent">{formatEth(order.receipt.total, { maxDecimals: 6 })}</span>
      <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm', status.className)}>
        <Icon className="size-4" aria-hidden="true" />
        {status.label}
      </span>
    </li>
  )
}
