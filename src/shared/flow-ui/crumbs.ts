export interface Crumb {
  label: string
  to?: '/' | '/cart' | '/checkout' | '/account/profile'
  hash?: string
}

export const MARKET_CRUMBS: Crumb[] = [
  { label: 'Início', to: '/' },
  { label: 'Mercado', to: '/', hash: 'catalogo' },
]
