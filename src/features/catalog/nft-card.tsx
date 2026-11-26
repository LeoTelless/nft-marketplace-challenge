import { Link } from '@tanstack/react-router'
import type { Nft } from '@/contracts'
import { formatEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'
import { HeartIcon } from '@/shared/ui/icons'
import { NftImage } from '@/shared/ui/nft-image'
import { Skeleton } from '@/shared/ui/skeleton'

export interface FavoriteControl {
  active: boolean
  pending: boolean
  onToggle: () => void
}

/** "Drifting Lighthouse #12" → ["Drifting Lighthouse", " #12"]: the second part never shrinks. */
function splitTokenNumber(name: string): [string, string] {
  const match = / #\d+$/.exec(name)
  return match ? [name.slice(0, match.index), match[0]] : [name, '']
}

/**
 * NFT card (frame 206 of the Figma grid, the reference card): artwork on a Surface Card box,
 * name and price below, always aligned. On mobile the box gets the rounded gradient of the
 * mobile frame. Names stay on one line, as in the frames: only the title is shortened with an
 * ellipsis, the token number ("#12") is always visible (full name in the accessible name and
 * the tooltip). The whole card is one link; the favorite button is a sibling (never nested).
 */
export function NftCard({
  nft,
  favorite,
  imageSizes = '(min-width: 1024px) 258px, (min-width: 768px) 30vw, 46vw',
  headingLevel = 3,
  priority = false,
  className,
}: {
  nft: Nft
  favorite?: FavoriteControl
  imageSizes?: string
  headingLevel?: 2 | 3 | 4
  /** Above-the-fold card: its artwork loads eagerly with high priority (LCP). */
  priority?: boolean
  className?: string
}) {
  const soldOut = nft.totalAvailable === 0
  const Heading = `h${headingLevel}` as const
  const [title, token] = splitTokenNumber(nft.name)
  return (
    <article data-testid="nft-card" data-nft-id={nft.id} className={cn('group relative flex flex-col', className)}>
      {/* Mobile frame: 175x200 box, artwork 12px from the top; desktop frame: 258x300, centered. */}
      <div
        data-slot="nft-card-box"
        className="flex aspect-[175/200] items-start justify-center rounded-[20px] bg-linear-135 from-surface to-surface-raised px-1 pt-3 md:aspect-[258/300] md:items-center md:rounded-none md:bg-none md:bg-surface md:pt-0"
      >
        <div className="relative aspect-square w-full overflow-hidden rounded-2xl md:rounded-[15px]">
          <NftImage
            image={nft.images[0]}
            sizes={imageSizes}
            alt=""
            priority={priority}
            className="transition-transform duration-300 group-hover:scale-[1.03]"
          />
          {soldOut ? (
            <span
              data-testid="nft-availability"
              className="absolute top-3 left-0 bg-brand px-2 py-1 text-[13px] leading-4 font-medium text-ink"
            >
              ESGOTADO
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-col px-2 pt-2 md:gap-3 md:px-0 md:pt-3">
        <Heading className="flex min-w-0 text-[15px] leading-5 font-normal text-foreground md:text-base md:leading-4">
          <Link
            to="/nft/$nftId"
            params={{ nftId: nft.id }}
            aria-label={nft.name}
            title={nft.name}
            className="flex min-w-0 after:absolute after:inset-0 after:content-[''] focus-visible:outline-0 focus-visible:after:rounded-[20px] focus-visible:after:outline-2 focus-visible:after:outline-solid focus-visible:after:outline-offset-2 focus-visible:after:outline-brand-accent md:focus-visible:after:rounded-none"
          >
            <span className="truncate">{title}</span>
            {token ? <span className="shrink-0 whitespace-pre">{token}</span> : null}
          </Link>
        </Heading>
        <p className="text-base leading-4 font-bold text-brand-accent md:text-lg">
          <span className="sr-only">{soldOut ? 'Esgotado. Último preço: ' : 'Preço: '}</span>
          <span data-testid="nft-price" className={cn(soldOut && 'text-text-muted line-through decoration-1')}>
            {formatEth(nft.minPrice)}
          </span>
        </p>
      </div>
      {favorite ? (
        <button
          type="button"
          onClick={favorite.onToggle}
          aria-pressed={favorite.active}
          aria-busy={favorite.pending || undefined}
          aria-label={`${favorite.active ? 'Remover dos favoritos' : 'Favoritar'}: ${nft.name}`}
          className={cn(
            // Mobile frame: 28px circle, 12px from the top and 10px from the right of the card.
            'absolute top-3 right-2.5 z-10 grid size-7 cursor-pointer place-content-center rounded-full border border-line bg-surface-raised/90 text-brand-accent transition-colors hover:border-brand md:right-3 md:size-8',
            favorite.pending && 'opacity-70',
          )}
        >
          <HeartIcon
            className={cn(
              'size-4',
              favorite.active
                ? 'fill-current'
                : 'fill-none [&_path]:fill-none [&_path]:stroke-current [&_path]:stroke-[1.6]',
            )}
          />
        </button>
      ) : null}
    </article>
  )
}

/** Same box model as `NftCard`, so swapping skeleton → card causes no layout shift. */
export function NftCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col', className)}>
      <div
        data-slot="nft-card-box"
        className="flex aspect-[175/200] items-start justify-center rounded-[20px] bg-surface px-1 pt-3 md:aspect-[258/300] md:items-center md:rounded-none md:pt-0"
      >
        <Skeleton className="aspect-square w-full rounded-2xl md:rounded-[15px]" />
      </div>
      <div className="flex flex-col px-2 pt-2 md:gap-3 md:px-0 md:pt-3">
        <Skeleton className="h-5 w-3/4 md:h-4" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  )
}
