import { useRef, useState, type KeyboardEvent } from 'react'
import type { Nft } from '@/contracts'
import { cn } from '@/shared/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/shared/ui/dialog'
import { SearchIcon } from '@/shared/ui/icons'
import { NftImage } from '@/shared/ui/nft-image'

/**
 * Gallery of one NFT: thumbnails (vertical on desktop, horizontal below `lg`) select the main
 * image. Thumbnails are buttons with `aria-pressed`; arrow keys move between them.
 * The magnifier opens the selected image larger in a dialog (focus trapped and restored).
 */
export function NftGallery({ nft }: { nft: Nft }) {
  const [selected, setSelected] = useState(0)
  const thumbs = useRef<Array<HTMLButtonElement | null>>([])
  const image = nft.images[Math.min(selected, nft.images.length - 1)]

  function onThumbKey(event: KeyboardEvent, index: number) {
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
    thumbs.current[next]?.focus()
  }

  return (
    <div className="flex flex-col-reverse gap-4 lg:flex-row lg:items-start lg:gap-7">
      {nft.images.length > 1 ? (
        <div role="group" aria-label="Imagens do NFT" className="flex gap-4 max-lg:justify-center lg:w-[100px] lg:flex-col">
          {nft.images.map((thumb, index) => (
            <button
              key={thumb.url}
              ref={(element) => {
                thumbs.current[index] = element
              }}
              type="button"
              aria-pressed={index === selected}
              aria-label={`Imagem ${index + 1} de ${nft.images.length}: ${thumb.alt}`}
              onClick={() => setSelected(index)}
              onKeyDown={(event) => onThumbKey(event, index)}
              className={cn(
                'size-16 shrink-0 cursor-pointer overflow-hidden rounded-md border bg-surface transition-colors md:size-20 lg:size-[100px]',
                index === selected ? 'border-brand' : 'border-transparent opacity-80 hover:opacity-100',
              )}
            >
              <NftImage image={thumb} sizes="100px" alt="" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative bg-linear-135 from-surface to-surface-raised p-0 max-md:-mx-6 max-md:px-7 max-md:pt-2 max-md:pb-10 md:rounded-sm md:bg-none md:bg-surface md:p-4 lg:w-[444px] lg:shrink-0">
        <div className="aspect-square overflow-hidden rounded-3xl">
          <NftImage image={image} sizes="(min-width: 1024px) 404px, (min-width: 768px) 60vw, 100vw" priority />
        </div>
        <Dialog>
          <DialogTrigger
            aria-label="Ampliar imagem"
            className="absolute top-[13px] right-[13px] grid size-[30px] cursor-pointer place-content-center rounded-full border border-line bg-surface-raised text-foreground hover:border-brand max-md:hidden"
          >
            <SearchIcon className="size-4" />
          </DialogTrigger>
          <DialogContent className="max-w-[min(90vw,800px)] p-3 sm:max-w-[min(90vw,800px)]">
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
