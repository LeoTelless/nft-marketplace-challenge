import type { Edition, Nft, NftCategory } from '@/contracts'
import { compareEth, normalizeEth, percentOfEth } from '@/shared/lib/eth'

/**
 * Deterministic catalog: generated from a fixed seed so every reset yields exactly the
 * same 48 NFTs (categories, price tiers from 0.0042 to 12.5 ETH, 1 to 3 editions,
 * fully sold-out NFTs and NFTs with a single sold-out edition).
 */
export const NFT_COUNT = 48

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CATEGORIES: NftCategory[] = ['art', 'gaming', 'music', 'photography', 'collectibles', 'sports']
const ADJECTIVES = [
  'Neon', 'Silent', 'Golden', 'Fractal', 'Lunar', 'Wild', 'Crystal', 'Velvet', 'Solar', 'Hidden', 'Electric', 'Ancient',
  'Frozen', 'Crimson', 'Quantum', 'Drifting',
]
const NOUNS: Record<NftCategory, string[]> = {
  art: ['Bloom', 'Horizon', 'Echo', 'Mosaic', 'Reverie', 'Prism', 'Canvas', 'Muse'],
  gaming: ['Paladin', 'Dungeon', 'Arcade', 'Blade', 'Quest', 'Golem', 'Sprite', 'Arena'],
  music: ['Anthem', 'Groove', 'Chorus', 'Ballad', 'Rhythm', 'Vinyl', 'Overture', 'Tempo'],
  photography: ['Skyline', 'Harbor', 'Desert', 'Glacier', 'Alley', 'Canyon', 'Meadow', 'Lighthouse'],
  collectibles: ['Token', 'Relic', 'Badge', 'Totem', 'Coin', 'Charm', 'Artifact', 'Gem'],
  sports: ['Goal', 'Sprint', 'Slam', 'Rally', 'Knockout', 'Finish', 'Dribble', 'Ace'],
}
const CREATORS = [
  { id: 'creator-01', name: 'Aurora Labs' },
  { id: 'creator-02', name: 'Pixel Monk' },
  { id: 'creator-03', name: 'Mara Ventura' },
  { id: 'creator-04', name: 'Studio Kairo' },
  { id: 'creator-05', name: 'Night Owl Collective' },
  { id: 'creator-06', name: 'Ilan Brooks' },
  { id: 'creator-07', name: 'Tropic Forge' },
  { id: 'creator-08', name: 'Yuki Arai' },
]
const PRICE_TIERS = ['0.0042', '0.015', '0.05', '0.08', '0.12', '0.25', '0.4', '0.75', '1.2', '2.5', '4.8', '12.5']
const EDITION_TEMPLATES = [
  { key: 'standard', name: 'Standard', pricePercent: 100, supply: [40, 200], maxPerOrder: 10 },
  { key: 'rare', name: 'Rare', pricePercent: 250, supply: [10, 30], maxPerOrder: 3 },
  { key: 'legendary', name: 'Legendary', pricePercent: 600, supply: [1, 5], maxPerOrder: 1 },
] as const

/** Local, self-contained artwork placeholder (until the Figma assets are exported). */
function artwork(seedA: number, seedB: number, label: string): string {
  const h1 = Math.floor(seedA * 360)
  const h2 = (h1 + 60 + Math.floor(seedB * 180)) % 360
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="hsl(${h1} 70% 55%)"/><stop offset="1" stop-color="hsl(${h2} 70% 35%)"/>` +
    `</linearGradient></defs><rect width="800" height="800" fill="url(#g)"/>` +
    `<circle cx="${200 + Math.floor(seedB * 400)}" cy="${200 + Math.floor(seedA * 400)}" r="160" fill="hsl(${h2} 80% 75% / 0.45)"/>` +
    `<text x="40" y="760" font-family="sans-serif" font-size="40" fill="white" fill-opacity="0.85">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function deriveNftAggregates(editions: Edition[]): Pick<Nft, 'minPrice' | 'totalAvailable'> {
  const minPrice = editions.reduce((min, e) => (compareEth(e.price, min) < 0 ? e.price : min), editions[0].price)
  return {
    minPrice: normalizeEth(minPrice),
    totalAvailable: editions.reduce((sum, e) => sum + e.available, 0),
  }
}

export function createNftFixtures(): Nft[] {
  const random = mulberry32(2026)
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)]
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const baseDate = Date.UTC(2026, 9, 31, 12, 0, 0)

  return Array.from({ length: NFT_COUNT }, (_, index) => {
    const n = index + 1
    const id = `nft-${String(n).padStart(3, '0')}`
    const category = CATEGORIES[index % CATEGORIES.length]
    const name = `${pick(ADJECTIVES)} ${pick(NOUNS[category])} #${n}`
    const creator = CREATORS[index % CREATORS.length]
    const basePrice = PRICE_TIERS[(index * 5) % PRICE_TIERS.length]
    const editionCount = (index % 3) + 1
    const soldOut = index % 9 === 4
    const lastEditionSoldOut = !soldOut && index % 5 === 2 && editionCount > 1

    const editions: Edition[] = EDITION_TEMPLATES.slice(0, editionCount).map((template, editionIndex) => {
      const supply = between(template.supply[0], template.supply[1])
      const isLast = editionIndex === editionCount - 1
      const available = soldOut || (lastEditionSoldOut && isLast) ? 0 : between(1, supply)
      return {
        id: `${id}-${template.key}`,
        name: template.name,
        price: percentOfEth(basePrice, template.pricePercent),
        supply,
        available,
        maxPerOrder: template.maxPerOrder,
      }
    })

    const seedA = random()
    const seedB = random()
    return {
      id,
      name,
      description: `${name} is a ${category} piece by ${creator.name}, minted as ${editionCount} edition${editionCount > 1 ? 's' : ''}.`,
      category,
      creator: { ...creator, avatarUrl: null },
      images: [
        { url: artwork(seedA, seedB, name), alt: `${name}, artwork by ${creator.name}`, width: 800, height: 800 },
        { url: artwork(seedB, seedA, `${name} (detail)`), alt: `${name}, detail view`, width: 800, height: 800 },
      ],
      editions,
      featured: index % 8 === 0,
      ...deriveNftAggregates(editions),
      createdAt: new Date(baseDate - index * 36 * 3_600_000).toISOString(),
      version: 1,
    }
  })
}

