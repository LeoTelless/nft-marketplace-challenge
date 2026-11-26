import type { Network, Nft, Order, OrderStatus, Quote, Wallet } from '@/contracts'

export interface DbUser {
  id: string
  name: string
  email: string
  username: string
  ensName: string
  bio: string
  avatarUrl: string | null
  /** SHA-256(`${salt}:${password}`), hex. Passwords are never stored in clear. */
  passwordHash: string
  salt: string
  createdAt: string
}

export interface DbSession {
  token: string
  userId: string
  createdAt: string
  expiresAt: string
}

export interface DbCartLine {
  id: string
  nftId: string
  editionId: string
  quantity: number
  addedUnitPrice: string
}

export interface DbCart {
  id: string
  /** `null` for a visitor cart (identified by `X-Cart-Id`). */
  userId: string | null
  lines: DbCartLine[]
  updatedAt: string
  version: number
}

export interface DbQuote extends Quote {
  cartId: string
  userId: string | null
  couponCode: string | null
}

export interface DbCoupon {
  code: string
  percentOff: number
  expiresAt: string
}

export interface DbOrder {
  order: Order
  userId: string
  cartId: string
  idempotencyKey: string
  /** Hash of the request body: same key + different hash = 409. */
  requestHash: string
  /** Epoch ms when the simulated payment resolves; `null` = only resolved manually. */
  resolveAt: number | null
  plannedOutcome: Exclude<OrderStatus, 'pending'>
  reserved: Array<{ nftId: string; editionId: string; quantity: number }>
}

export interface DbWallet extends Wallet {
  userId: string
}

/**
 * Simulated wallet connection (`POST /wallets/:id/connect`). One active connection per session, as in a
 * browser wallet (one account on one chain at a time): connecting again replaces it, a declined request or
 * `DELETE /wallets/:id/connect` removes it, and it ends with the session. `POST /orders` requires it.
 */
export interface DbWalletConnection {
  sessionToken: string
  userId: string
  walletId: string
  network: Network
  connectedAt: string
}

export interface DbState {
  schemaVersion: 1
  seq: number
  eventSeq: number
  users: DbUser[]
  sessions: DbSession[]
  nfts: Nft[]
  favorites: Record<string, string[]>
  carts: DbCart[]
  quotes: DbQuote[]
  orders: DbOrder[]
  wallets: DbWallet[]
  walletConnections: DbWalletConnection[]
  coupons: DbCoupon[]
}

export const NETWORK_FEES: Record<Network, string> = {
  ethereum: '0.0025',
  polygon: '0.0001',
  arbitrum: '0.0004',
  base: '0.0003',
}
