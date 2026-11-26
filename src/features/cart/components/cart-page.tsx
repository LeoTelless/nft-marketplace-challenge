import { Link } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, ShoppingCart, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CartItem, Quote } from '@/contracts'
import { NftCard, NftCardSkeleton } from '@/features/catalog/nft-card'
import { useNftList } from '@/features/catalog/queries'
import { useFavorites } from '@/features/favorites/use-favorites'
import { editionLabel, tokenLabel } from '@/features/nft/editions'
import { cartItemImage, cartItemLabel, exactEth } from '../format'
import { MARKET_CRUMBS } from '@/shared/flow-ui/crumbs'
import { Breadcrumb, MobileScreenHeader, SectionTitle } from '@/shared/flow-ui/page-chrome'
import { StatusPage } from '@/shared/layout/status-page'
import { multiplyEth } from '@/shared/lib/eth'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'
import { DeleteIcon } from '@/shared/ui/icons'
import { NftImage } from '@/shared/ui/nft-image'
import { Skeleton } from '@/shared/ui/skeleton'
import { describeCartItem, useCart } from '../use-cart'
import { useCartChangeNotices } from '../use-cart-change-notices'
import { useRemoveCartItem, useUpdateCartItem } from '../use-cart-mutations'
import { useQuote } from '../use-quote'
import { CartStepper } from './cart-stepper'
import { CouponForm, SummaryRows } from './summary'

/** Grid of the desktop table: NFT, price, editions, total, remove (Figma column positions). */
const COLUMNS = 'md:grid md:grid-cols-[minmax(0,250px)_77px_75px_87px_24px] md:items-center md:justify-between md:gap-x-4 lg:gap-x-[61px]'

/** Carrinho de NFTs (desktop table + summary; mobile cards + bottom summary panel). */
export function CartPage() {
  const cart = useCart()
  const quote = useQuote()
  useCartChangeNotices(cart.owner)

  const items = cart.data?.items ?? []
  const empty = cart.isSuccess && items.length === 0
  // Empty/error states have their own h1 (StatusPage): the screen title is then plain text.
  const stateScreen = empty || Boolean(cart.sessionError) || (cart.isError && !cart.data)

  return (
    // Mobile: 32px top and 28px side margins of the frame.
    <div className="container-page min-h-dvh pt-8 max-md:[--page-gutter:1.75rem]">
      <Breadcrumb items={[...MARKET_CRUMBS, { label: 'Carrinho' }]} />
      <MobileScreenHeader title="Carrinho de NFTs" titleAs={stateScreen ? 'p' : 'h1'} />
      {stateScreen ? null : <h1 className="sr-only max-md:hidden">Carrinho de NFTs</h1>}

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
              <div aria-busy="true" aria-label="Carregando carrinho" className="mt-[9px] flex flex-col gap-5 md:mt-3 md:gap-3">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-[100px] w-full rounded-[15px] md:h-[70px] md:rounded-none" />
                ))}
              </div>
            ) : (
              <ul aria-label="Itens do carrinho" className="mt-[9px] flex flex-col gap-5 md:mt-3 md:gap-3">
                {items.map((item) => (
                  <CartLine key={item.id} item={item} quote={quote.data} />
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="cart-summary-title"
            // Mobile: the summary sits below the list, so it waits for the cart (the number of lines
            // is unknown while loading and it would jump); desktop keeps it with its own skeleton.
            // Mobile panel of the frame: 4px after the list, 24/24/36 padding, 12px between the
            // coupon and the rows, 32px before the CTA.
            className={cn(
              'flex flex-col gap-6 max-md:-mx-7 max-md:-mt-5 max-md:gap-3 max-md:rounded-t-[40px] max-md:bg-surface max-md:px-6 max-md:pt-6 max-md:pb-9 lg:w-[332px] lg:shrink-0',
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
            <div className="flex flex-col gap-3 max-md:mt-5">
              {quote.data?.issues.length ? (
                <p className="text-sm text-text-secondary">Ajuste os itens indisponíveis para finalizar a compra.</p>
              ) : quote.data ? (
                <Link
                  to="/checkout"
                  className={cn(
                    buttonVariants(),
                    // Mobile: 60px pill with the frame gradient; desktop: 40px, 3px radius.
                    'h-[60px] w-full rounded-full bg-linear-135 from-brand to-brand/80 text-base font-bold hover:from-brand-accent hover:to-brand-accent md:h-10 md:rounded-[3px] md:bg-brand md:bg-none md:text-[15px] md:hover:bg-brand-accent',
                  )}
                >
                  Conectar e finalizar
                </Link>
              ) : (
                // Totals still loading: same box, not navigable yet.
                <span
                  role="link"
                  aria-disabled="true"
                  className={cn(buttonVariants(), 'h-[60px] w-full rounded-full text-base font-bold md:h-10 md:rounded-[3px] md:text-[15px]')}
                >
                  Conectar e finalizar
                </span>
              )}
              <Link
                to="/"
                hash="catalogo"
                className="self-center text-[15px] leading-5 text-brand-accent underline-offset-4 hover:underline max-md:hidden"
              >
                Continuar explorando
              </Link>
            </div>
          </section>
        </div>
      )}

      {/* After the cart is known, so the section never pushes the list or the summary around. */}
      {cart.isSuccess && !empty ? <CartRecommendations exclude={items.map((item) => item.nftId)} /> : null}
    </div>
  )
}

function CartLine({ item, quote }: { item: CartItem; quote: Quote | undefined }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const state = describeCartItem(item)
  const label = cartItemLabel(item)
  const optimistic = item.id.startsWith('optimistic-')

  const priceNote = state.priceChanged ? (
    <span className="inline-flex items-center gap-1 text-xs leading-4 font-normal text-amber">
      {state.priceDirection === 'up' ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
      Preço {state.priceDirection === 'up' ? 'subiu' : 'caiu'} (era {exactEth(item.addedUnitPrice)})
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
        // Mobile: the 100px card with the frame shadow; desktop: the 70px table row.
        'relative flex min-h-[100px] rounded-[14px] bg-surface shadow-[0_6px_20px_#0A060473] md:min-h-[70px] md:rounded-none md:pr-6 md:shadow-none',
        COLUMNS,
      )}
    >
      {/* NFT */}
      <div className="flex min-w-0 items-center gap-2 md:gap-4">
        <div className="size-[100px] shrink-0 self-start overflow-hidden max-[359px]:size-20 rounded-l-[14px] bg-surface-raised md:size-[70px] md:self-auto md:rounded-[6px]">
          <NftImage image={cartItemImage(item)} sizes="100px" />
        </div>
        {/* Mobile: name and edition stop before the stepper column (they wrap instead of running
            under it); the price sits below the vertically centered stepper. */}
        <div className="flex min-w-0 flex-col gap-1.5 self-start py-3 pr-12 md:self-auto md:py-0 md:pr-0">
          <Link
            to="/nft/$nftId"
            params={{ nftId: item.nftId }}
            search={{ edition: item.editionId }}
            className="line-clamp-2 text-[15px] leading-4 font-bold break-words text-foreground hover:text-brand-accent max-md:mr-14 md:text-base"
          >
            {item.nftName}
          </Link>
          <span className="text-sm leading-4 text-text-secondary max-md:mr-14 md:text-text-muted">
            <span className="md:hidden">Edição: {editionLabel({ name: item.editionName })}</span>
            <span className="max-md:hidden">ID do token: {tokenLabel(item.nftId)}</span>
          </span>
          <span className="mt-[11px] text-lg leading-4 font-bold text-brand-accent md:hidden">{exactEth(item.unitPrice)}</span>
          {priceNote ? <span className="md:hidden">{priceNote}</span> : null}
          {stockNote ? <span className="md:hidden">{stockNote}</span> : null}
        </div>
      </div>
      {/* Price (desktop) */}
      <p className="text-base leading-4 font-bold whitespace-nowrap text-text-secondary max-md:hidden">
        <span className="sr-only">Preço unitário: </span>
        {exactEth(item.unitPrice)}
      </p>
      {/* Quantity: on the mobile card, vertically centered on the right (frame). */}
      <div className="absolute top-[38px] right-4 md:static">
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
        {exactEth(lineTotal(item, quote))}
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
        // Iconly "Delete": #D28A4C on the mobile card (above the stepper), #B39463 in the table.
        className="absolute top-2 right-4 grid size-6 cursor-pointer place-content-center rounded-sm text-brand hover:text-coral disabled:opacity-40 md:static md:text-text-muted"
      >
        <DeleteIcon className="size-6" />
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

/**
 * Line total of the quote when it matches the line (same edition, quantity and price);
 * until the quote of the current cart arrives, `unitPrice × quantity` (exact decimal
 * arithmetic). The summary totals always come from the quote.
 */
function lineTotal(item: CartItem, quote: Quote | undefined) {
  const line = quote?.lines.find((l) => l.nftId === item.nftId && l.editionId === item.editionId)
  if (line && line.quantity === item.quantity && line.unitPrice === item.unitPrice) return line.lineTotal
  return multiplyEth(item.unitPrice, item.quantity)
}

/** Cards of the carousel: 3 pages of 5 on desktop (the three dots of the frame). */
const RECOMMENDED_MAX = 15
const ROW = 'scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 md:gap-6 lg:gap-7'
const CELL = 'w-[175px] shrink-0 snap-start md:w-[220px] lg:w-[calc((100%-4*28px)/5)]'

/**
 * "Colecionadores também viram": the most recently listed NFTs that are not in the cart, in a
 * horizontal carousel (native scroll + snap) with the page dots of the frame below it.
 * Desktop/tablet only: the mobile frame ends at the summary panel.
 */
function CartRecommendations({ exclude }: { exclude: string[] }) {
  // A fixed page (not sized by the cart) keeps the same query while items are added or removed.
  const list = useNftList({ sort: 'newest', page: 1, pageSize: 32 })
  const favorites = useFavorites()
  const items = list.data?.items.filter((nft) => !exclude.includes(nft.id)).slice(0, RECOMMENDED_MAX)
  const scroller = useRef<HTMLUListElement>(null)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(0)

  const measure = useCallback(() => {
    const element = scroller.current
    if (!element) return
    const total = Math.max(1, Math.ceil(element.scrollWidth / element.clientWidth - 0.05))
    const atEnd = element.scrollLeft >= element.scrollWidth - element.clientWidth - 2
    setPages(total)
    setPage(atEnd ? total - 1 : Math.min(total - 1, Math.round(element.scrollLeft / element.clientWidth)))
  }, [])

  useEffect(() => {
    const element = scroller.current
    if (!element) return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [measure, items?.length])

  if (list.isError || (items && items.length === 0)) return null

  return (
    <section aria-labelledby="cart-related-title" className="mt-24 max-md:hidden">
      <h2 id="cart-related-title" className="border-b border-brand/30 pb-3 text-[17px] leading-4 font-bold text-brand-accent">
        Colecionadores também viram
      </h2>
      {items ? (
        <>
          <ul ref={scroller} onScroll={measure} aria-label="NFTs recomendados" className={cn(ROW, 'mt-8')}>
            {items.map((nft) => (
              <li key={nft.id} className={CELL}>
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
          {/* 12px dots 32px below the cards; 24px targets. The row keeps its height (no shift). */}
          <div className="mt-[26px] h-6">
            {pages > 1 ? (
              <div role="group" aria-label="Páginas do carrossel" className="flex justify-center gap-1">
                {Array.from({ length: pages }, (_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Página ${index + 1} de ${pages}`}
                    aria-pressed={index === page}
                    onClick={() => {
                      const element = scroller.current
                      element?.scrollTo({ left: index * element.clientWidth, behavior: 'smooth' })
                    }}
                    className="grid size-6 cursor-pointer place-content-center"
                  >
                    <span
                      aria-hidden="true"
                      className={cn('block size-3 rounded-full border-[1.3px] border-brand', index === page ? 'bg-brand' : 'bg-transparent')}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <div aria-busy="true" aria-label="Carregando recomendações" className={cn(ROW, 'mt-8')}>
            {Array.from({ length: 5 }, (_, i) => (
              <NftCardSkeleton key={i} className={CELL} />
            ))}
          </div>
          <div className="mt-[26px] h-6" />
        </>
      )}
    </section>
  )
}
