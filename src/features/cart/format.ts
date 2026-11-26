import type { CartItem } from '@/contracts'
import { editionLabel } from '@/features/nft/editions'
import { ETH_DECIMALS, formatEth } from '@/shared/lib/eth'

/** "Nome do NFT (Edição)", the accessible name of a cart line. */
export function cartItemLabel(item: Pick<CartItem, 'nftName' | 'editionName'>) {
  return `${item.nftName} (${editionLabel({ name: item.editionName })})`
}

/** Cart/quote lines only carry the artwork URL: square 800px variants of the fixtures. */
export function cartItemImage(item: Pick<CartItem, 'imageUrl'>) {
  return { url: item.imageUrl, alt: '', width: 800, height: 800 }
}

/**
 * ETH amount of the purchase flows (cart, payment, receipt, orders) exactly as the API sent it:
 * every decimal is kept (up to wei), only trailing zeros are dropped, so `0.6703701` is shown as
 * `0.6703701 ETH` and never truncated or rounded.
 */
export function exactEth(value: string) {
  return formatEth(value, { maxDecimals: ETH_DECIMALS })
}
