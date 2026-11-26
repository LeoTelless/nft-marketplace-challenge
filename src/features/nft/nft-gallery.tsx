import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { Nft } from '@/contracts'
import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { SearchIcon } from '@/shared/ui/icons'
import { NftImage } from '@/shared/ui/nft-image'

/**
 * Gallery of one NFT (4 views of the same artwork).
 * - ≥ md (desktop frame): column of 100px thumbnails + 444px main image with a magnifier that
 *   opens the image larger in a dialog (focus trapped and restored by Radix).
 * - < md (mobile frame): full-bleed artwork with the slide dots over it; `overlay` renders the
 *   back/favorite buttons above the image, as in the frame.
 * Thumbnails and dots are buttons with `aria-pressed`; arrow keys move between them.
 */
export function NftGallery({ nft, overlay }: { nft: Nft; overlay?: ReactNode }) {
  const [selected, setSelected] = useState(0)
  const thumbs = useRef<Array<HTMLButtonElement | null>>([])
  const dots = useRef<Array<HTMLButtonElement | null>>([])
  const image = nft.images[Math.min(selected, nft.images.length - 1)]

  function onKey(event: KeyboardEvent, index: number, refs: Array<HTMLButtonElement | null>) {
    const last = nft.images.length - 1
    const next =
      event.key === 'ArrowDown' || event.key === 'ArrowRight'
        ? index === last
          ? 0
          : index + 1
        : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
          ? index === 0
            ? last
            : index - 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    setSelected(next)
    refs[next]?.focus()
  }

  const label = (index: number) => `Imagem ${index + 1} de ${nft.images.length}: ${nft.images[index].alt}`

  return (
    <div className="relative max-md:-mx-6 max-md:bg-linear-135 max-md:from-surface max-md:to-surface-raised max-md:px-7 max-md:pt-[66px] md:flex md:flex-col-reverse md:gap-4 lg:flex-row lg:items-start lg:gap-7">
      {overlay}
      {nft.images.length > 1 ? (
        <div
          role="group"
          aria-label="Imagens do NFT"
          className="hidden gap-4 md:flex md:justify-center lg:w-[100px] lg:flex-col"
        >
          {nft.images.map((thumb, index) => (
            <button
              key={thumb.url}
              ref={(element) => {
                thumbs.current[index] = element
              }}
              type="button"
              aria-pressed={index === selected}
              aria-label={label(index)}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => onKey(event, index, thumbs.current)}
              className={cn(
                'size-20 shrink-0 cursor-pointer overflow-hidden rounded-sm bg-surface p-0 transition-opacity lg:size-[100px]',
                index === selected ? 'ring-1 ring-brand' : 'opacity-80 hover:opacity-100',
              )}
            >
              <NftImage image={thumb} sizes="100px" alt="" className="rounded-md" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative md:rounded-sm md:bg-surface md:p-4 lg:w-[444px] lg:shrink-0">
        <div className="aspect-[361/356] overflow-hidden rounded-3xl md:aspect-square">
          <NftImage image={image} sizes="(min-width: 1024px) 404px, (min-width: 768px) 480px, 100vw" priority />
        </div>
        {nft.images.length > 1 ? (
          <div
            role="group"
            aria-label="Imagens do NFT"
            className="absolute inset-x-0 bottom-[57px] flex justify-center gap-1.5 md:hidden"
          >
            {nft.images.map((dot, index) => (
              <button
                key={dot.url}
                ref={(element) => {
                  dots.current[index] = element
                }}
                type="button"
                aria-pressed={index === selected}
                aria-label={label(index)}
                onClick={() => setSelected(index)}
                onKeyDown={(event) => onKey(event, index, dots.current)}
                className="grid h-6 min-w-6 cursor-pointer place-content-center"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'block h-[7px] rounded-full bg-brand transition-all',
                    index === selected ? 'w-7' : 'w-[7px] opacity-70',
                  )}
                />
              </button>
            ))}
          </div>
        ) : null}
        <Dialog>
          <DialogTrigger
            aria-label="Ampliar imagem"
            className="absolute top-[13px] right-[13px] grid size-[30px] cursor-pointer place-content-center rounded-full border border-line bg-surface-raised text-foreground hover:border-brand max-md:hidden"
          >
            <SearchIcon className="size-4" />
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,800px)] p-3 sm:max-w-[min(90vw,800px)]" data-testid="zoom-dialog">
            <DialogTitle className="sr-only">{nft.name}</DialogTitle>
            <DialogDescription className="sr-only">{image.alt}</DialogDescription>
            <div className="aspect-square overflow-hidden rounded-lg">
              <NftImage image={image} sizes="800px" />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
