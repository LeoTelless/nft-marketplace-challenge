/** REST paths, relative to the API base URL. Shared by the app and the mocks. */
export const endpoints = {
  register: '/auth/register',
  login: '/auth/login',
  logout: '/auth/logout',
  session: '/session',
  nfts: '/nfts',
  nft: (id: string) => `/nfts/${id}`,
  favorites: '/favorites',
  favorite: (nftId: string) => `/favorites/${nftId}`,
  cart: '/cart',
  cartItems: '/cart/items',
  cartItem: (itemId: string) => `/cart/items/${itemId}`,
  quotes: '/quotes',
  orders: '/orders',
  order: (id: string) => `/orders/${id}`,
  profile: '/profile',
  avatar: '/profile/avatar',
  password: '/profile/password',
  wallets: '/wallets',
  wallet: (id: string) => `/wallets/${id}`,
  walletConnect: (id: string) => `/wallets/${id}/connect`,
} as const

export const HEADERS = {
  cartId: 'X-Cart-Id',
  idempotencyKey: 'Idempotency-Key',
} as const

/** Socket.IO server path (default of socket.io). */
export const SOCKET_PATH = '/socket.io/'

export const DEFAULT_API_BASE_URL = '/api'
