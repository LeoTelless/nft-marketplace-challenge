import { createFileRoute, Link } from '@tanstack/react-router'
import type { Order } from '@/contracts'
import { useOrder } from '@/features/orders/use-order'
import { useRealtimeStatus } from '@/shared/realtime/realtime-provider'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { formatEth } from '@/shared/lib/eth'
import { Button } from '@/shared/ui/button'

/**
 * Provisional order screen (flow skeleton). The confirmation and receipt render **only**
 * for an order the simulation reported as `confirmed` (REST or `order.updated`); pending and
 * rejected orders have their own states. The receipt is the order snapshot, never the catalog.
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
      <div className="mx-auto max-w-3xl p-6" aria-busy="true">
        <h1 className="text-2xl font-semibold">Pedido</h1>
        <p>Carregando pedido…</p>
      </div>
    )
  }
  if (order.isError) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Pedido</h1>
        <div role="alert">
          <p>{apiErrorMessage(order.error)}</p>
          <Button variant="secondary" onClick={() => void order.refetch()}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const data = order.data
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6" data-order-status={data.status}>
      {data.status === 'pending' ? (
        <section aria-labelledby="order-title" className="flex flex-col gap-2">
          <h1 id="order-title" className="text-2xl font-semibold">
            Pagamento em processamento
          </h1>
          <p role="status">Aguardando a confirmação da rede. Você pode recarregar a página: o pedido não será duplicado.</p>
          {realtime !== 'connected' ? <p className="text-sm">Reconectando ao servidor de atualizações…</p> : null}
        </section>
      ) : data.status === 'rejected' ? (
        <section aria-labelledby="order-title" className="flex flex-col gap-2">
          <h1 id="order-title" className="text-2xl font-semibold">
            Pagamento recusado
          </h1>
          <p>{data.rejectionReason ?? 'O pagamento não foi concluído.'} Os itens continuam no seu carrinho.</p>
          <Button asChild>
            <Link to="/cart">Voltar ao carrinho</Link>
          </Button>
        </section>
      ) : (
        <ConfirmedOrder order={data} />
      )}
    </div>
  )
}

function ConfirmedOrder({ order }: { order: Order }) {
  const { receipt, transaction } = order
  return (
    <section aria-labelledby="order-title" className="flex flex-col gap-4">
      <h1 id="order-title" className="text-2xl font-semibold">
        Compra confirmada
      </h1>
      <p>Seus NFTs agora estão na sua carteira.</p>
      <section aria-label="Recibo" className="flex flex-col gap-2 rounded-md border p-4">
        <h2 className="font-semibold">Detalhes da transação</h2>
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt>Pedido</dt>
          <dd>{order.id}</dd>
          <dt>Data</dt>
          <dd>{new Date(order.createdAt).toLocaleString('pt-BR')}</dd>
          <dt>ID da transação (simulado)</dt>
          <dd className="break-all" data-testid="transaction-hash">
            {transaction?.hash}
          </dd>
          <dt>Carteira</dt>
          <dd className="break-all">{receipt.walletAddress}</dd>
          <dt>Rede</dt>
          <dd>{receipt.network}</dd>
        </dl>
        <ul aria-label="Itens comprados" className="flex flex-col gap-1 text-sm">
          {receipt.lines.map((line) => (
            <li key={`${line.nftId}-${line.editionId}`} className="flex justify-between gap-2">
              <span>
                {line.nftName} ({line.editionName}) × {line.quantity}
              </span>
              <span>{formatEth(line.lineTotal, { maxDecimals: 6 })}</span>
            </li>
          ))}
        </ul>
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt>Subtotal</dt>
          <dd className="text-right">{formatEth(receipt.subtotal, { maxDecimals: 6 })}</dd>
          <dt>Desconto</dt>
          <dd className="text-right">{formatEth(receipt.discount, { maxDecimals: 6 })}</dd>
          <dt>Taxa de rede</dt>
          <dd className="text-right">{formatEth(receipt.networkFee, { maxDecimals: 6 })}</dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold" data-testid="receipt-total">
            {formatEth(receipt.total, { maxDecimals: 6 })}
          </dd>
        </dl>
        {transaction ? (
          <a href={transaction.explorerUrl} target="_blank" rel="noreferrer noopener" className="text-sm underline">
            Ver no explorador (link simulado)
          </a>
        ) : null}
      </section>
    </section>
  )
}
