import type { Edition, Nft } from '@/contracts'

const EDITION_LABELS: Record<string, string> = {
  Standard: 'Padrão',
  Rare: 'Rara',
  Legendary: 'Lendária',
}

export function editionLabel(edition: Pick<Edition, 'name'>): string {
  return EDITION_LABELS[edition.name] ?? edition.name
}

/** Edition shown on arrival: the requested one (URL) if it exists, else the first available, else the first. */
export function initialEdition(nft: Nft, requestedId: string | undefined): Edition {
  return (
    nft.editions.find((e) => e.id === requestedId) ??
    nft.editions.find((e) => e.available > 0) ??
    nft.editions[0]
  )
}

/** "nft-042" → "#0042" (token id shown in the layout). */
export function tokenLabel(nftId: string): string {
  const digits = nftId.replace(/\D/g, '')
  return `#${digits.padStart(4, '0')}`
}
