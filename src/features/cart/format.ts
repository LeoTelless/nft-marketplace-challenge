import type { CartItem } from '@/contracts'
import { editionLabel } from '@/features/nft/editions'

/** "Nome do NFT (Edição)", the accessible name of a cart line. */
export function cartItemLabel(item: Pick<CartItem, 'nftName' | 'editionName'>) {
  return `${item.nftName} (${editionLabel({ name: item.editionName })})`
}

/** Cart/quote lines only carry the artwork URL: square 800px variants of the fixtures. */
export function cartItemImage(item: Pick<CartItem, 'imageUrl'>) {
  return { url: item.imageUrl, alt: '', width: 800, height: 800 }
}
