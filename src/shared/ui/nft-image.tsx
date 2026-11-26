import type { NftImage as NftImageData } from '@/contracts'
import { cn } from '@/shared/lib/utils'

const LOCAL_ARTWORK = /^(\/images\/nft\/[a-z0-9-]+)-\d+\.webp$/
const WIDTHS = [256, 512, 800] as const

/**
 * Responsive NFT artwork. Local artwork (exported from Figma in AVIF/WebP at 256/512/800 px,
 * see `scripts/optimize-assets.mjs`) gets `srcset`s for both formats; any other URL is used
 * as is. Width/height always come from the API so the box is reserved before loading (no CLS).
 * `priority` is for the single above-the-fold image (LCP): eager + high fetch priority.
 */
export function NftImage({
  image,
  sizes,
  className,
  priority = false,
  alt,
}: {
  image: NftImageData
  sizes: string
  className?: string
  priority?: boolean
  /** Overrides the API alt text (e.g. `""` when the image is decorative next to its caption). */
  alt?: string
}) {
  const match = LOCAL_ARTWORK.exec(image.url)
  const common = {
    alt: alt ?? image.alt,
    width: image.width,
    height: image.height,
    loading: priority ? ('eager' as const) : ('lazy' as const),
    fetchPriority: priority ? ('high' as const) : ('auto' as const),
    decoding: 'async' as const,
    className: cn('size-full object-cover', className),
  }
  if (!match) return <img src={image.url} {...common} />

  const base = match[1]
  const srcSet = (ext: string) => WIDTHS.map((w) => `${base}-${w}.${ext} ${w}w`).join(', ')
  return (
    <picture className="contents">
      <source type="image/avif" srcSet={srcSet('avif')} sizes={sizes} />
      <img src={image.url} srcSet={srcSet('webp')} sizes={sizes} {...common} />
    </picture>
  )
}
