import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useEffect, useId, useState } from 'react'
import type { Edition, Nft } from '@/contracts'
import { CATEGORY_LABELS } from '@/features/catalog/catalog-search'
import { remainingForEdition, quantityInCart, useCart } from '@/features/cart/use-cart'
import { useAddToCart } from '@/features/cart/use-cart-mutations'
import { useFavorites } from '@/features/favorites/use-favorites'
import { compareEth, formatEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { ChevronLeftIcon, HeartIcon, LinkedinIcon, MessageIcon, ShopIcon, TwitterIcon } from '@/shared/ui/icons'
import { editionLabel, initialEdition, tokenLabel } from './editions'
import { NftGallery } from './nft-gallery'
import { QuantityStepper } from './quantity-stepper'

/**
 * Detail of one NFT (desktop frame, mobile frame below `md`): gallery, information, edition
 * picker, quantity, favorite and purchase. Price and availability come from the query cache,
 * which `nft.updated` events patch in real time; changes are announced politely.
 */
export function NftDetail({
  nft,
  editionId,
  onEditionChange,
}: {
  nft: Nft
  editionId: string | undefined
  onEditionChange: (editionId: string) => void
}) {
  const edition = initialEdition(nft, editionId)
  const favorites = useFavorites()
  const isFavorite = favorites.isFavorite(nft.id)
  const favoritePending = favorites.pending(nft.id)
  const toggleFavorite = () => favorites.toggle(nft.id, nft.name)
  const announcement = useLiveChanges(nft, edition)

  return (
    <div className="container-page md:pt-8">
      <Breadcrumb />

      <div className="flex flex-col md:mt-3 md:gap-8 lg:flex-row lg:gap-8">
        <div className="relative md:max-lg:mx-auto md:max-lg:w-[480px] lg:w-[573px] lg:shrink-0">
          <NftGallery
            nft={nft}
            overlay={
              <MobileImageActions
                isFavorite={isFavorite}
                pending={favoritePending}
                onToggle={toggleFavorite}
                name={nft.name}
              />
            }
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 max-md:relative max-md:z-10 max-md:-mx-6 max-md:-mt-[30px] max-md:rounded-t-[31px] max-md:bg-surface max-md:px-6 max-md:pt-8 max-md:pb-6 md:gap-5">
          <header className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 max-md:items-center">
              <h1 className="text-xl leading-6 font-bold text-foreground md:text-[28px] md:leading-[37px]">
                {nft.name}
              </h1>
              {/* Mobile: the creator takes the place of the rating chip of the frame. */}
              <p className="max-w-[50%] shrink-0 rounded-2xl border border-brand px-2.5 py-1 text-right text-sm leading-4 text-text-secondary md:hidden">
                por <span className="text-foreground">{nft.creator.name}</span>
              </p>
            </div>
            {/* Frame: 20px row, 12px to the divider (y 210), "Sobre este NFT" 13px below it. */}
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-brand/30 pb-3 max-md:hidden">
              <p className="text-[22px] leading-5 font-bold text-brand-accent">
                <span className="sr-only">Preço da edição {editionLabel(edition)}: </span>
                <span
                  data-testid="detail-price"
                  className={cn('rounded-xs transition-colors', announcement.flash && 'bg-brand/20')}
                >
                  {formatEth(edition.price)}
                </span>
              </p>
              <p className="text-[15px] leading-5 text-text-secondary">
                por <span className="text-foreground">{nft.creator.name}</span>
              </p>
            </div>
          </header>

          {/* Price/availability changes pushed by the server (nft.updated) are announced here. */}
          <p aria-live="polite" aria-atomic="true" className="sr-only" data-testid="detail-live">
            {announcement.text}
          </p>
          {announcement.text ? (
            <p className="-mt-2 text-[13px] leading-5 text-amber" aria-hidden="true">
              {announcement.text}
            </p>
          ) : null}

          <section aria-labelledby="about-title" className="flex flex-col gap-3 md:-mt-[7px]">
            <h2 id="about-title" className="text-[15px] leading-4 font-bold text-foreground max-md:sr-only">
              Sobre este NFT:
            </h2>
            <p className="text-sm leading-6 text-text-secondary">{nft.description}</p>
          </section>

          <EditionPicker nft={nft} selected={edition} onChange={onEditionChange} />

          <PurchasePanel
            key={edition.id}
            nft={nft}
            edition={edition}
            isFavorite={isFavorite}
            favoritePending={favoritePending}
            onToggleFavorite={toggleFavorite}
            priceFlash={announcement.flash}
          />

          <dl className="flex flex-col gap-3 text-[15px] leading-5 text-text-muted">
            <div className="flex gap-[9px]">
              <dt>ID do token:</dt>
              <dd>{tokenLabel(nft.id)}</dd>
            </div>
            <div className="flex gap-[9px]">
              <dt>Coleção:</dt>
              <dd>
                <Link
                  to="/"
                  search={{ category: [nft.category] }}
                  hash="catalogo"
                  activeOptions={{ includeHash: true }}
                  className="hover:text-brand-accent hover:underline"
                >
                  {CATEGORY_LABELS[nft.category]}
                </Link>
              </dd>
            </div>
            <div className="flex gap-[9px]">
              <dt>Edições:</dt>
              <dd>{nft.editions.map(editionLabel).join(', ')}</dd>
            </div>
          </dl>
          <ShareLinks nft={nft} />
        </div>
      </div>
    </div>
  )
}

/** "Início / Mercado", as in the frame (the page title is the h1 right below). */
function Breadcrumb() {
  return (
    <nav aria-label="Trilha de navegação" className="max-md:hidden">
      <ol className="flex flex-wrap items-center gap-1.5 text-[15px] leading-4 font-bold text-foreground">
        <li>
          <Link to="/" className="hover:text-brand-accent">
            Início
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link to="/" hash="catalogo" activeOptions={{ includeHash: true }} className="hover:text-brand-accent">
            Mercado
          </Link>
        </li>
      </ol>
    </nav>
  )
}

/** Back and favorite buttons over the artwork (mobile frame). */
function MobileImageActions({
  isFavorite,
  pending,
  onToggle,
  name,
}: {
  isFavorite: boolean
  pending: boolean
  onToggle: () => void
  name: string
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const circle =
    'grid size-[35px] cursor-pointer place-content-center rounded-full border border-line bg-surface-raised text-foreground'
  return (
    <div className="pointer-events-none absolute top-[23px] right-[25px] left-7 z-10 flex justify-between md:hidden">
      <button
        type="button"
        aria-label="Voltar"
        className={cn(circle, 'pointer-events-auto')}
        onClick={() => (window.history.length > 1 ? router.history.back() : void navigate({ to: '/' }))}
      >
        <ChevronLeftIcon className="size-5 text-text-secondary" />
      </button>
      <FavoriteToggle
        compact
        className={cn(circle, 'pointer-events-auto text-brand-accent')}
        isFavorite={isFavorite}
        pending={pending}
        onToggle={onToggle}
        name={name}
      />
    </div>
  )
}

function FavoriteToggle({
  isFavorite,
  pending,
  onToggle,
  name,
  compact = false,
  className,
}: {
  isFavorite: boolean
  pending: boolean
  onToggle: () => void
  name: string
  compact?: boolean
  className?: string
}) {
  const icon = (
    <HeartIcon
      className={cn(
        compact ? 'size-4' : 'size-5',
        isFavorite ? '[&_path]:fill-current' : '[&_path]:fill-none [&_path]:stroke-current [&_path]:stroke-[1.6]',
      )}
    />
  )
  return (
    <button
      type="button"
      data-testid="favorite-toggle"
      aria-pressed={isFavorite}
      aria-busy={pending || undefined}
      aria-label={compact ? `${isFavorite ? 'Remover dos favoritos' : 'Favoritar'}: ${name}` : undefined}
      onClick={onToggle}
      className={className}
    >
      {icon}
      {compact ? null : isFavorite ? 'Favoritado' : 'Favoritar'}
    </button>
  )
}

/** Editions as a radio group of pills (layout "Edição:"). Sold-out editions stay visible, disabled. */
function EditionPicker({ nft, selected, onChange }: { nft: Nft; selected: Edition; onChange: (id: string) => void }) {
  const titleId = useId()
  const infoId = useId()
  // A radiogroup labelled by a paragraph (not fieldset/legend, whose box ignores the flex gap).
  return (
    <div className="flex flex-col gap-2 md:gap-3">
      <p id={titleId} className="text-[15px] leading-4 font-bold text-foreground">
        Edição:
      </p>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        aria-describedby={infoId}
        className="flex flex-wrap gap-3 md:gap-1.5"
      >
        {nft.editions.map((edition) => {
          const soldOut = edition.available === 0
          const checked = edition.id === selected.id
          return (
            <label
              key={edition.id}
              className={cn(
                'relative flex h-7 min-w-[42px] items-center justify-center rounded-[50%] border px-2.5 text-sm leading-4 transition-colors',
                checked ? 'border-brand font-medium text-brand-accent' : 'border-line text-text-secondary',
                soldOut ? 'cursor-not-allowed text-text-muted line-through' : 'cursor-pointer hover:border-brand',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-brand-accent',
              )}
            >
              <input
                type="radio"
                name={`edition-${nft.id}`}
                value={edition.id}
                checked={checked}
                disabled={soldOut}
                onChange={() => onChange(edition.id)}
                className="sr-only"
              />
              {editionLabel(edition)}
              {soldOut ? <span className="sr-only"> (esgotada)</span> : null}
            </label>
          )
        })}
      </div>
      <p id={infoId} data-testid="edition-availability" className="text-[13px] leading-5 text-text-secondary">
        {selected.available === 0
          ? `Edição ${editionLabel(selected)} esgotada.`
          : `Tiragem 1/${selected.supply} · ${selected.available} disponíveis · máx. ${selected.maxPerOrder} por pedido`}
      </p>
    </div>
  )
}

function PurchasePanel({
  nft,
  edition,
  isFavorite,
  favoritePending,
  onToggleFavorite,
  priceFlash,
}: {
  nft: Nft
  edition: Edition
  isFavorite: boolean
  favoritePending: boolean
  onToggleFavorite: () => void
  priceFlash: boolean
}) {
  const cart = useCart()
  const addToCart = useAddToCart()
  const navigate = useNavigate()
  const labelId = useId()
  const hintId = useId()
  const [requested, setQuantity] = useState(1)

  const inCart = quantityInCart(cart.data, nft.id, edition.id)
  const remaining = remainingForEdition(cart.data, nft, edition.id)
  const soldOut = edition.available === 0
  const max = Math.max(1, remaining)
  const blocked = soldOut || remaining === 0

  // A smaller limit (units sold meanwhile, cart changes) clamps the quantity. The panel is
  // keyed by edition, so switching editions starts again from 1.
  const quantity = Math.min(Math.max(1, requested), max)

  const hint = soldOut
    ? nft.totalAvailable === 0
      ? 'Este NFT está esgotado.'
      : 'Esta edição está esgotada. Escolha outra edição.'
    : remaining === 0
      ? `Você já tem o máximo permitido desta edição no carrinho (${inCart}).`
      : quantity >= remaining
        ? `Limite atingido: até ${remaining} ${remaining === 1 ? 'unidade' : 'unidades'} desta edição${inCart ? ` (você já tem ${inCart} no carrinho)` : ''}.`
        : inCart
          ? `Você já tem ${inCart} desta edição no carrinho.`
          : ''

  async function add(goToCart: boolean) {
    if (blocked || addToCart.isPending) return
    try {
      await addToCart.mutateAsync({ nft, editionId: edition.id, quantity })
      setQuantity(1)
      if (goToCart) void navigate({ to: '/cart' })
    } catch {
      // Feedback (assertive notice) and rollback are handled by the mutation.
    }
  }

  const pending = addToCart.isPending
  return (
    <div
      data-testid="purchase-panel"
      className="flex flex-col gap-5 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:rounded-t-[40px] max-md:bg-surface max-md:px-6 max-md:pt-5 max-md:pb-[max(env(safe-area-inset-bottom),36px)] max-md:shadow-[0_0_20px_0_#0a060473] md:gap-3 max-md:[@media(max-height:500px)]:static max-md:[@media(max-height:500px)]:mt-2 max-md:[@media(max-height:500px)]:-mx-6"
    >
      {/* Desktop frame: COMPRAR and Favoritar aligned with the top of the stepper. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-5 md:items-start">
        <div className="flex items-center gap-2">
          <span id={labelId} className="text-[15px] leading-4 font-medium text-text-secondary md:sr-only">
            Qtd.
          </span>
          <QuantityStepper
            value={quantity}
            max={max}
            onChange={setQuantity}
            disabled={blocked}
            labelId={labelId}
            describedBy={hint ? hintId : undefined}
          />
        </div>
        <p
          aria-hidden="true"
          className={cn('text-xl leading-4 font-bold text-brand-accent md:hidden', priceFlash && 'bg-brand/20')}
        >
          {formatEth(edition.price)}
        </p>
        <div className="flex items-center gap-3 md:gap-2">
          <Button
            data-testid="buy-now"
            onClick={() => void add(true)}
            disabled={blocked}
            aria-disabled={pending || undefined}
            aria-describedby={hint ? hintId : undefined}
            className="h-[60px] flex-1 rounded-[40px] bg-linear-135 from-brand to-brand/80 px-11 text-base font-bold max-md:min-w-[196px] md:h-10 md:w-[130px] md:flex-none md:rounded-sm md:bg-none md:px-4 md:text-sm"
          >
            <span className="md:hidden">Comprar NFT</span>
            <span className="max-md:hidden">COMPRAR</span>
          </Button>
          <Button
            data-testid="add-to-cart"
            variant="secondary"
            size="icon"
            onClick={() => void add(false)}
            disabled={blocked}
            aria-disabled={pending || undefined}
            aria-busy={pending || undefined}
            aria-label={pending ? 'Adicionando ao carrinho…' : 'Adicionar ao carrinho'}
            className="size-[60px] rounded-full text-text-muted md:size-10 md:rounded-sm md:text-text-secondary"
          >
            <ShopIcon className="size-5" />
          </Button>
          <FavoriteToggle
            isFavorite={isFavorite}
            pending={favoritePending}
            onToggle={onToggleFavorite}
            name={nft.name}
            className="inline-flex h-10 w-[130px] cursor-pointer items-center justify-center gap-2 rounded-sm border border-brand text-sm leading-5 font-medium text-brand-accent transition-colors hover:bg-brand/10 max-md:hidden"
          />
        </div>
      </div>
      <p id={hintId} role="status" className={cn('text-[13px] leading-5 text-amber', !hint && 'sr-only')}>
        {hint}
      </p>
    </div>
  )
}

/**
 * Detects price/availability changes of the selected edition (pushed by `nft.updated`) and
 * describes them. The previous values are kept in state and compared during render.
 */
function useLiveChanges(nft: Nft, edition: Edition) {
  const [seen, setSeen] = useState({ id: edition.id, price: edition.price, available: edition.available })
  const [text, setText] = useState('')
  const [flashKey, setFlashKey] = useState(0)
  const [flash, setFlash] = useState(false)

  if (seen.id !== edition.id || seen.price !== edition.price || seen.available !== edition.available) {
    setSeen({ id: edition.id, price: edition.price, available: edition.available })
    if (seen.id === edition.id) {
      const parts: string[] = []
      const priceChange = compareEth(edition.price, seen.price)
      if (priceChange !== 0) {
        parts.push(
          `Preço ${priceChange > 0 ? 'subiu' : 'caiu'} de ${formatEth(seen.price)} para ${formatEth(edition.price)}.`,
        )
      }
      if (edition.available !== seen.available) {
        parts.push(
          edition.available === 0
            ? 'Esta edição acabou de esgotar.'
            : `Disponibilidade atualizada: ${edition.available} ${edition.available === 1 ? 'unidade' : 'unidades'}.`,
        )
      }
      if (parts.length) {
        setText(`${nft.name} (${editionLabel(edition)}): ${parts.join(' ')}`)
        setFlash(true)
        setFlashKey((key) => key + 1)
      }
    } else {
      setText('')
    }
  }

  // The highlight fades after 2 s (the text stays until the next change).
  useEffect(() => {
    if (flashKey === 0) return
    const timer = setTimeout(() => setFlash(false), 2_000)
    return () => clearTimeout(timer)
  }, [flashKey])

  return { text, flash }
}

function ShareLinks({ nft }: { nft: Nft }) {
  const url = typeof window === 'undefined' ? '' : `${window.location.origin}/nft/${nft.id}`
  const text = `${nft.name} na KURIO`
  const link = 'grid size-6 place-content-center text-foreground hover:text-brand-accent'
  // Not in the mobile frame: desktop/tablet only.
  return (
    <div className="flex items-center gap-2 max-md:hidden">
      <p className="text-[15px] leading-4 font-bold text-foreground">Compartilhar este NFT:</p>
      {/* Frame: icons ~24px apart (the 24px targets sit side by side). */}
      <div className="flex">
        <a
          className={link}
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Compartilhar no LinkedIn (abre em nova aba)"
        >
          <LinkedinIcon className="size-8" />
        </a>
        <a
          className={link}
          href={`mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(url)}`}
          aria-label="Compartilhar por e-mail"
        >
          <MessageIcon className="size-[18px]" />
        </a>
        <a
          className={link}
          href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Compartilhar no X (abre em nova aba)"
        >
          <TwitterIcon className="size-8" />
        </a>
      </div>
    </div>
  )
}

/** "Detalhes do NFT" block below the purchase area. */
export function NftDetailsSection({ nft }: { nft: Nft }) {
  return (
    <section aria-labelledby="details-title" className="container-page mt-16 md:mt-24">
      <div className="border-b border-brand/30">
        <h2
          id="details-title"
          className="relative inline-block pb-3 text-[17px] leading-4 font-bold text-brand-accent after:absolute after:inset-x-0 after:-bottom-px after:h-[3px] after:bg-brand"
        >
          Detalhes do NFT
        </h2>
      </div>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-6 text-text-secondary">
        <p>
          {/* On mobile the description is already the first paragraph of the purchase area, right above. */}
          <span className="max-md:hidden">{nft.description} </span>A propriedade inclui a arte em alta resolução,
          lançamentos exclusivos para colecionadores e um registro permanente de procedência registrado na rede.
        </p>
        <div>
          <h3 className="font-bold text-foreground">Rede:</h3>
          <p>Cunhado na Ethereum com procedência imutável e metadados armazenados no IPFS.</p>
        </div>
        <div>
          <h3 className="font-bold text-foreground">Contrato:</h3>
          <p>0x7A42...19E8 • Contrato inteligente ERC-721 verificado.</p>
        </div>
        <div>
          <h3 className="font-bold text-foreground">Direitos autorais:</h3>
          <p>
            Direitos autorais do criador: 5% nas vendas secundárias, pagos automaticamente pelos mercados compatíveis.
          </p>
        </div>
      </div>
    </section>
  )
}
