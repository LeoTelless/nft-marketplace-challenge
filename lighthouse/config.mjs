/**
 * Lighthouse audit configuration (versioned, see ../README.md).
 *
 * Both profiles use Lighthouse's default simulated throttling ("lantern"):
 *  - mobile:  Moto G Power emulation, 4x CPU slowdown, 150 ms RTT, 1.6 Mbps down / 750 Kbps up
 *  - desktop: 1350x940, 1x CPU, 40 ms RTT, 10 Mbps down / 10 Mbps up
 * Nothing in the audited app is switched off for the audit: same build, same mocks, same images and fonts.
 */
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

export const RUNS = 3
export const PORT = 4180
export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

/** Pages audited. The NFT id belongs to the default mock scenario (`src/mocks/fixtures/nfts.ts`). */
export const PAGES = [
  { id: 'inicio', label: 'Início', path: '/' },
  { id: 'detalhe', label: 'Detalhe do NFT', path: '/nft/nft-001' },
]

export const PROFILES = [
  {
    id: 'mobile',
    label: 'Mobile',
    config: {
      extends: 'lighthouse:default',
      settings: { onlyCategories: CATEGORIES, throttlingMethod: 'simulate', formFactor: 'mobile' },
    },
  },
  {
    id: 'desktop',
    label: 'Desktop',
    config: {
      ...desktopConfig,
      settings: { ...desktopConfig.settings, onlyCategories: CATEGORIES, throttlingMethod: 'simulate' },
    },
  },
]
