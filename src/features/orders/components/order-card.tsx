import { Link } from '@tanstack/react-router'
import { CircleX, Hourglass } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Order } from '@/contracts'
import { cartItemImage, exactEth } from '@/features/cart/format'
import { formatOrderDate } from '../format'
import { editionLabel, tokenLabel } from '@/features/nft/editions'
import { NETWORK_LABELS, shortAddress } from '@/features/wallets/format'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button'
import { CloseIcon } from '@/shared/ui/icons'
import { NftImage } from '@/shared/ui/nft-image'
import { Skeleton } from '@/shared/ui/skeleton'
import thankYouUrl from '../assets/thank-you.svg'

const eth = exactEth

/** The API reason may come without a final period; the next sentence follows it. */
function sentence(text: string) {
  return /[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`
}

/**
 * The "Confirmação de pedido" card of the Figma (modal look: Surface Card, orange rules and
 * 10px orange bottom bar), used for the three states. The receipt (items, fees, transaction)
 * is rendered **only** for `confirmed` orders, from the order snapshot.
 */
export function OrderCard({ order }: { order: Order }) {
  return (
    <article
      data-order-status={order.status}
      className="relative mx-auto w-full max-w-[578px] border-b-[10px] border-brand bg-surface"
    >
      {/* Frame: 18px #D28A4C "X" 17px from the top and 14px from the right; 36px target. */}
      <Link
        to="/"
        aria-label="Fechar e voltar ao início"
        className="absolute top-2 right-[5px] grid size-9 place-content-center rounded-full text-brand hover:text-brand-accent"
      >
        <CloseIcon className="size-[18px]" />
      </Link>
      {order.status === 'confirmed' ? <Confirmed order={order} /> : order.status === 'pending' ? <Pending order={order} /> : <Rejected order={order} />}
    </article>
  )
}

function Header({ icon, title, children }: { icon: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col items-center gap-4 border-b border-brand px-6 pt-[22px] pb-[22px] text-center md:px-9">
      {icon}
      <h1 className="text-base leading-4 font-bold text-text-secondary">{title}</h1>
      {children}
    </header>
  )
}

function Meta({ items }: { items: Array<{ label: string; value: ReactNode; strong?: boolean }> }) {
  return (
    // Frame: 65px strip, 36px side padding, columns split by 1px orange rules.
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-brand px-6 py-3 text-text-secondary sm:flex sm:min-h-[65px] sm:items-center sm:justify-between sm:gap-3 sm:px-9 sm:py-[14px]">
      {items.map((item, index) => (
        <div key={item.label} className={cn('flex flex-col', index > 0 && 'sm:border-l sm:border-brand sm:pl-4')}>
          <dt className={cn('text-sm leading-4 sm:whitespace-nowrap', item.strong && 'font-bold')}>{item.label}</dt>
          <dd className="text-sm leading-5 break-all sm:break-normal sm:text-[15px] sm:whitespace-nowrap">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Confirmed({ order }: { order: Order }) {
  const { receipt, transaction } = order
  return (
    <>
      <Header
        icon={<img src={thankYouUrl} alt="" width={80} height={80} className="size-20" />}
        title={
          <>
            <span className="sr-only">Compra confirmada. </span>Seus NFTs agora estão na sua carteira
          </>
        }
      />
      <Meta
        items={[
          {
            label: 'ID da transação',
            strong: true,
            value: (
              <span data-testid="transaction-hash" data-hash={transaction?.hash} title={transaction?.hash}>
                {transaction ? shortAddress(transaction.hash) : '—'}
              </span>
            ),
          },
          { label: 'Data', value: formatOrderDate(order.updatedAt) },
          { label: 'Total', value: eth(receipt.total) },
          { label: 'Carteira', strong: true, value: shortAddress(receipt.walletAddress) },
        ]}
      />
      <section aria-label="Recibo" className="flex flex-col gap-3 px-6 pt-5 pb-12 md:px-11">
        <h2 className="text-[15px] leading-4 font-bold">Detalhes da transação</h2>
        {/* Columns of the frame: NFTs | Edições (left-aligned) | 48px | Subtotal (right). */}
        <div aria-hidden="true" className="flex border-b border-brand/30 pb-3 text-base leading-4 max-sm:[&>span:nth-child(2)]:hidden">
          <span className="flex-1 font-bold">NFTs</span>
          <span className="font-bold">Edições</span>
          <span className="ml-12 font-medium">Subtotal</span>
        </div>
        <ul aria-label="Itens comprados" className="flex flex-col gap-3">
          {receipt.lines.map((line) => (
            <li key={`${line.nftId}-${line.editionId}`} className="flex min-h-[70px] flex-wrap items-center gap-x-3 gap-y-1">
              <div className="size-[70px] shrink-0 overflow-hidden rounded-[8px]">
                <NftImage image={cartItemImage(line)} sizes="70px" />
              </div>
              <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
                <span className="line-clamp-2 text-base leading-4 font-bold break-words">{line.nftName}</span>
                <span className="text-sm leading-4 text-text-muted">
                  ID do token: {tokenLabel(line.nftId)}
              {/* The frame line only has the token; the edition is added when it is not the standard one. */}
              {line.editionName === 'Standard' ? null : ` · ${editionLabel({ name: line.editionName })}`}
                </span>
              </div>
              {/* The amount never wraps: the column takes the width of the full value. */}
              <span className="ml-auto flex items-center gap-3 whitespace-nowrap sm:gap-12">
                <span className="text-right text-sm leading-4 text-text-secondary">
                  <span className="sr-only">Quantidade: </span>(x {line.quantity})
                </span>
                <span className="text-right text-lg leading-4 font-bold text-brand-accent">{eth(line.lineTotal)}</span>
              </span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto grid w-full max-w-[321px] grid-cols-[1fr_auto] gap-x-4 gap-y-3">
          <dt className="text-[15px] leading-5">Subtotal</dt>
          <dd className="text-right text-lg leading-5">{eth(receipt.subtotal)}</dd>
          {receipt.discount !== '0' ? (
            <>
              <dt className="text-[15px] leading-5">Desconto{receipt.coupon ? ` (${receipt.coupon.code})` : ''}</dt>
              <dd className="text-right text-lg leading-5">(-) {eth(receipt.discount)}</dd>
            </>
          ) : null}
          <dt className="text-[15px] leading-5">Taxa de rede</dt>
          <dd className="text-right text-lg leading-5">{eth(receipt.networkFee)}</dd>
          <dt className="text-base leading-5 font-bold">Total</dt>
          <dd className="text-right text-lg leading-5 font-bold text-brand-accent" data-testid="receipt-total">
            {eth(receipt.total)}
          </dd>
        </dl>
        {/* Full-width rule under the totals (frame "Line 13", 490px). */}
        <div aria-hidden="true" className="h-px bg-brand/30" />
        <p className="text-center text-sm leading-[22px] text-text-secondary">
          Transação confirmada na {NETWORK_LABELS[receipt.network]}. A propriedade foi transferida para sua carteira conectada e
          registrada na rede.
        </p>
        {transaction ? (
          <div className="mt-9 flex flex-col items-center gap-1.5">
            <a
              href={transaction.explorerUrl}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(buttonVariants(), 'h-12 rounded-[5px] px-4 text-base font-bold')}
            >
              Ver no Etherscan
              <span className="sr-only"> (link simulado, abre em nova aba)</span>
            </a>
            <p className="text-xs text-text-muted">Referência simulada: a transação não existe na rede real.</p>
          </div>
        ) : null}
      </section>
    </>
  )
}

function Pending({ order }: { order: Order }) {
  return (
    <>
      <Header
        icon={
          <span className="grid size-20 place-content-center rounded-full bg-brand/15 text-brand-accent">
            <Hourglass className="size-9 motion-safe:animate-pulse" aria-hidden="true" />
          </span>
        }
        title="Pagamento em processamento"
      >
        <p role="status" className="max-w-sm text-sm leading-6 text-text-secondary">
          Aguardando a confirmação da rede. Você pode recarregar esta página: o pedido não será duplicado e o recibo aparece
          assim que o pagamento for confirmado.
        </p>
      </Header>
      <Meta
        items={[
          { label: 'Pedido', strong: true, value: order.id },
          { label: 'Data', value: formatOrderDate(order.createdAt) },
          { label: 'Total', value: eth(order.receipt.total) },
        ]}
      />
      <div className="px-6 py-6 text-center text-sm text-text-muted md:px-11">Os itens continuam reservados enquanto o pagamento é processado.</div>
    </>
  )
}

function Rejected({ order }: { order: Order }) {
  return (
    <>
      <Header
        icon={
          <span className="grid size-20 place-content-center rounded-full bg-coral/15 text-coral">
            <CircleX className="size-9" aria-hidden="true" />
          </span>
        }
        title="Pagamento recusado"
      >
        <p className="max-w-sm text-sm leading-6 text-text-secondary">
          {sentence(order.rejectionReason ?? 'O pagamento não foi concluído')} Nenhum valor foi cobrado e os itens continuam no seu carrinho.
        </p>
      </Header>
      <Meta
        items={[
          { label: 'Pedido', strong: true, value: order.id },
          { label: 'Data', value: formatOrderDate(order.updatedAt) },
          { label: 'Total', value: eth(order.receipt.total) },
        ]}
      />
      <div className="flex flex-wrap justify-center gap-3 px-6 py-8">
        <Link to="/cart" className={buttonVariants()}>
          Voltar ao carrinho
        </Link>
        <Link to="/orders" className={buttonVariants({ variant: 'outline' })}>
          Meus pedidos
        </Link>
      </div>
    </>
  )
}

/**
 * Loading state of the order page: same page padding and card box (header, meta strip, two
 * lines, totals, action) and a viewport-tall page, so the footer never moves (CLS).
 */
export function OrderCardSkeleton() {
  return (
    <div className="container-page min-h-dvh py-8 md:pt-24 md:pb-16">
      <div
        aria-busy="true"
        aria-label="Carregando pedido"
        className="mx-auto flex max-w-[578px] flex-col gap-4 border-b-[10px] border-surface-raised bg-surface px-6 pt-[22px] pb-12 md:px-11"
      >
        <Skeleton className="mx-auto size-20 rounded-full" />
        <Skeleton className="mx-auto h-4 w-2/3" />
        <Skeleton className="h-[65px] w-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-[70px] w-full" />
        <Skeleton className="h-[70px] w-full" />
        <Skeleton className="ml-auto h-[110px] w-full max-w-[321px]" />
        <Skeleton className="mx-auto h-12 w-48" />
      </div>
    </div>
  )
}
