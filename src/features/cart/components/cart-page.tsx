import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ShoppingCart, Trash2, TriangleAlert } from 'lucide-react'
import type { CartItem } from '@/contracts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useNftList } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/use-favorites'
import { editionLabel, tokenLabel } from '@/features/nft/editions'
import { cartItemImage, cartItemLabel } from '../format'
import { MARKET_CRUMBS } from '@/shared/flow-ui/crumbs'
import { Breadcrumb, MobileScreenHeader, SectionTitle } from '@/shared/flow-ui/page-chrome'
import { StatusPage } from '@/shared/layout/status-page'
import { formatEth, multiplyEth } from '@/shared/lib/eth'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'
import { NftImage } from '@/shared/ui/nft-image'
import { Skeleton } from '@/shared/ui/skeleton'
import { describeCartItem, useCart } from '../use-cart'
import { useCartChangeNotices } from '../use-cart-change-notices'
import { useRemoveCartItem, useUpdateCartItem } from '../use-cart-mutations'
import { useQuote } from '../use-quote'
import { CartStepper } from './cart-stepper'
import { CouponForm, SummaryRows } from './summary'

const eth = (value: string) => formatEth(value, { maxDecimals: 6 })

/** Grid of the desktop table: NFT, price, editions, total, remove (Figma column positions). */
const COLUMNS = 'md:grid md:grid-cols-[minmax(0,250px)_77px_75px_87px_24px] md:items-center md:justify-between md:gap-x-4 lg:gap-x-[61px]'

/** Carrinho de NFTs (desktop table + summary; mobile cards + bottom summary panel). */
export function CartPage() {
  const cart = useCart()
  const quote = useQuote()
  useCartChangeNotices(cart.owner)

  const items = cart.data?.items ?? []
  const empty = cart.isSuccess && items.length === 0

  return (
    <div className="container-page min-h-dvh pt-4 md:pt-8">
      <Breadcrumb items={[...MARKET_CRUMBS, { label: 'Carrinho' }]} />
      <MobileScreenHeader title="Carrinho de NFTs" />
      <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>

      {cart.sessionError ? (
        // The session could not be validated, so whose cart to show is unknown.
        <StatusPage
          icon={TriangleAlert}
          tone="error"
          title="Não foi possível carregar o carrinho"
          testId="cart-session-error"
          actions={
            <Button onClick={cart.retrySession} disabled={cart.retryingSession}>
              {cart.retryingSession ? 'Tentando…' : 'Tentar novamente'}
            </Button>
          }
        >
          <p>Não conseguimos verificar a sua sessão. {apiErrorMessage(cart.sessionError)}</p>
        </StatusPage>
      ) : cart.isError && !cart.data ? (
        <StatusPage
          icon={TriangleAlert}
          tone="error"
          title="Não foi possível carregar o carrinho"
          actions={
            <Button onClick={() => void cart.refetch()} disabled={cart.isFetching}>
              Tentar novamente
            </Button>
          }
        >
          <p>{apiErrorMessage(cart.error)}</p>
        </StatusPage>
      ) : empty ? (
        <StatusPage
          icon={ShoppingCart}
          title="Seu carrinho está vazio."
          actions={
            <Link to="/" hash="catalogo" className={buttonVariants()}>
              Continuar explorando
            </Link>
          }
        >
          <p>Explore o mercado e adicione NFTs para comprar.</p>
        </StatusPage>
      ) : (
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:justify-between lg:gap-10">
          <section aria-labelledby="cart-items-title" className="min-w-0 lg:w-[782px]">
            <h2 id="cart-items-title" tabIndex={-1} className="sr-only">
              NFTs no carrinho
            </h2>
            <div aria-hidden="true" className={cn('hidden border-b border-brand/30 pr-6 pb-3 text-base leading-4', COLUMNS)}>
              <span className="font-bold">NFTs</span>
              <span className="font-medium">Preço</span>
              <span className="font-bold">Edições</span>
              <span className="font-medium">Total</span>
              <span />
            </div>
            {cart.isPending ? (
              <div aria-busy="true" aria-label="Carregando carrinho" className="mt-3 flex flex-col gap-5 md:gap-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-[100px] w-full rounded-[15px] md:h-[70px] md:rounded-none" />
                ))}
              </div>
            ) : (
              <ul aria-label="Itens do carrinho" className="mt-3 flex flex-col gap-5 md:gap-3">
                {items.map((item) => (
                  <CartLine key={item.id} item={item} />
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="cart-summary-title"
            // Mobile: the summary sits below the list, so it waits for the cart (the number of lines
            // is unknown while loading and it would jump); desktop keeps it with its own skeleton.
            className={cn(
              'flex flex-col gap-6 max-md:-mx-6 max-md:rounded-t-[40px] max-md:bg-surface max-md:px-6 max-md:pt-6 max-md:pb-9 lg:w-[332px] lg:shrink-0',
              cart.isPending && 'max-md:hidden',
            )}
          >
            <SectionTitle id="cart-summary-title" className="max-md:sr-only">
              Resumo da carteira
            </SectionTitle>
            <CouponForm />
            <section aria-label="Resumo do pedido">
              <SummaryRows quote={quote.data} updating={quote.isUpdating && !cart.isPending} />
            </section>
            <div className="flex flex-col gap-3">
              {quote.data?.issues.length ? (
                <p className="text-sm text-text-secondary">Ajuste os itens indisponíveis para finalizar a compra.</p>
              ) : (
                <Link
                  to="/checkout"
                  className={cn(buttonVariants(), 'h-[60px] w-full rounded-full text-base font-bold md:h-10 md:rounded-sm md:text-[15px]')}
                >
                  Conectar e finalizar
                </Link>
              )}
              <Link to="/" hash="catalogo" className="text-center text-base text-brand-accent underline-offset-4 hover:underline max-md:hidden">
                Continuar explorando
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* After the cart is known, so the section never pushes the list or the summary around. */}
      {cart.isSuccess && !empty ? <CartRecommendations /> : null}
    </div>
  )
}

function CartLine({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const state = describeCartItem(item)
  const label = cartItemLabel(item)
  const optimistic = item.id.startsWith('optimistic-')

  const priceNote = state.priceChanged ? (
    <span className="inline-flex items-center gap-1 text-xs leading-4 font-normal text-amber">
      {state.priceDirection === 'up' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
      Preço {state.priceDirection === 'up' ? 'subiu' : 'caiu'} (era {eth(item.addedUnitPrice)})
    </span>
  ) : null
  const stockNote = state.soldOut ? (
    <span className="inline-flex items-center gap-1 text-xs leading-4 text-coral">
      <TriangleAlert className="size-3" aria-hidden="true" />
      Esgotado: remova o item para finalizar.
    </span>
  ) : state.exceedsAvailability ? (
    <span className="inline-flex items-center gap-1 text-xs leading-4 text-coral">
      <TriangleAlert className="size-3" aria-hidden="true" />
      Restam apenas {item.available} unidade(s).
    </span>
  ) : null

  return (
    <li
      aria-label={label}
      aria-busy={optimistic || undefined}
      className={cn(
        'relative flex min-h-[100px] overflow-hidden rounded-[15px] bg-surface md:min-h-[70px] md:rounded-none md:pr-6',
        COLUMNS,
      )}
    >
      {/* NFT */}
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <div className="size-[100px] shrink-0 overflow-hidden bg-surface-raised md:size-[70px]">
          <NftImage image={cartItemImage(item)} sizes="100px" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5 py-3 pr-11 md:py-0 md:pr-0">
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.nftId }}
            search={{ edition: item.editionId }}
            className="line-clamp-2 text-[15px] leading-[18px] font-bold break-words text-foreground hover:text-brand-accent md:text-base"
          >
            {item.nftName}
          </Link>
          <span className="text-sm leading-4 text-text-secondary md:text-text-muted">
            <span className="md:hidden">Edição: {editionLabel({ name: item.editionName })}</span>
            <span className="max-md:hidden">ID do token: {tokenLabel(item.nftId)}</span>
          </span>
          <span className="mt-2 text-lg leading-4 font-bold text-brand-accent md:hidden">{eth(item.unitPrice)}</span>
          <span className="md:hidden">{priceNote}</span>
          <span className="md:hidden">{stockNote}</span>
        </div>
      </div>
      {/* Price (desktop) */}
      <p className="text-base leading-4 font-bold whitespace-nowrap text-text-secondary max-md:hidden">
        <span className="sr-only">Preço unitário: </span>
        {eth(item.unitPrice)}
      </p>
      {/* Quantity */}
      <div className="absolute right-4 bottom-4 md:static">
        <CartStepper
          label={label}
          value={item.quantity}
          max={state.max}
          disabled={optimistic}
          onChange={(quantity) => update.mutate({ item, quantity })}
        />
      </div>
      {/* Total (desktop) */}
      <p className="text-base leading-4 font-bold whitespace-nowrap text-brand-accent max-md:hidden">
        <span className="sr-only">Total do item: </span>
        {eth(lineTotal(item))}
      </p>
      <button
        type="button"
        aria-label={`Remover ${label}`}
        disabled={optimistic || remove.isPending}
        onClick={(event) => {
          // Keep keyboard users in place: next line's "Remover", else the previous one, else the list title.
          const line = event.currentTarget.closest('li')
          const sibling = line?.nextElementSibling ?? line?.previousElementSibling
          const next = sibling?.querySelector<HTMLElement>('button[aria-label^="Remover"]')
          remove.mutate({ item })
          if (next) requestAnimationFrame(() => next.focus())
          // Last line: the list becomes the empty state, so focus the main region once it rendered.
          else setTimeout(() => (document.getElementById('cart-items-title') ?? document.getElementById('conteudo'))?.focus(), 300)
        }}
        className="absolute top-3 right-3 grid size-8 cursor-pointer place-content-center rounded-sm text-text-muted hover:text-coral disabled:opacity-40 md:static md:size-6"
      >
        <Trash2 className="size-5" aria-hidden="true" />
      </button>
      {priceNote || stockNote ? (
        // Desktop: the notes get a full-width strip under the row, never squeezed into a column.
        <p className="col-span-full -mt-2 mb-3 flex flex-wrap gap-x-5 gap-y-1 pl-[86px] max-md:hidden">
          {priceNote}
          {stockNote}
        </p>
      ) : null}
    </li>
  )
}

/** `unitPrice × quantity` for display only (the totals always come from the quote). */
function lineTotal(item: CartItem) {
  return multiplyEth(item.unitPrice, item.quantity)
}

/** "Colecionadores também viram": featured NFTs (horizontal scroll below `lg`). */
function CartRecommendations() {
  const list = useNftList({ featured: true, sort: 'newest', page: 1, pageSize: 5 })
  const favorites = useFavorites()
  if (list.isError) return null
  const row = 'flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 scrollbar-none md:gap-6 lg:grid lg:grid-cols-5 lg:gap-7 lg:overflow-visible'
  const cell = 'w-[175px] shrink-0 snap-start md:w-[220px] lg:w-auto'
  return (
    <section aria-labelledby="cart-related-title" className="mt-16 md:mt-24">
      <h2 id="cart-related-title" className="border-b border-brand/30 pb-3 text-[17px] leading-4 font-bold text-brand-accent">
        Colecionadores também viram
      </h2>
      {list.data ? (
        <ul className={`${row} mt-8`}>
          {list.data.items.map((nft) => (
            <li key={nft.id} className={cell}>
              <NftCard
                nft={nft}
                imageSizes="(min-width: 1024px) 220px, 175px"
                favorite={{
                  active: favorites.isFavorite(nft.id),
                  pending: favorites.pending(nft.id),
                  onToggle: () => favorites.toggle(nft.id, nft.name),
                }}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div aria-busy="true" aria-label="Carregando recomendações" className={`${row} mt-8`}>
          {Array.from({ length: 5 }, (_, i) => (
            <NftCardSkeleton key={i} className={cell} />
          ))}
        </div>
      )}
    </section>
  )
}
