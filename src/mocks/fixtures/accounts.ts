import type { DbCoupon, DbUser, DbWallet } from '../db/types'

/**
 * Fictitious accounts (credentials documented in the README):
 * - ana@nftmarket.test / Jungle@2026
 * - bruno@nftmarket.test / Market@2026
 * Only salted SHA-256 hashes are stored: `sha256(`${salt}:${password}`)`.
 */
export const USER_FIXTURES: DbUser[] = [
  {
    id: 'user-ana',
    name: 'Ana Souza',
    email: 'ana@nftmarket.test',
    bio: 'Collector of generative art.',
    avatarUrl: null,
    salt: 'b3f1c2a9e4d5',
    passwordHash: 'c70d0da0a6b548caa190ca138592fdb91b9be7d7d4fd15adb14745314ef247eb',
    createdAt: '2026-01-10T10:00:00.000Z',
  },
  {
    id: 'user-bruno',
    name: 'Bruno Lima',
    email: 'bruno@nftmarket.test',
    bio: '',
    avatarUrl: null,
    salt: '7c9e0a1f2b3d',
    passwordHash: '87982c4317cabc9195b870426dcb7791c25398aba9abb6283382d60bcccb191f',
    createdAt: '2026-03-02T15:30:00.000Z',
  },
]

export const WALLET_FIXTURES: DbWallet[] = [
  {
    id: 'wallet-ana-main',
    userId: 'user-ana',
    label: 'Main MetaMask',
    address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    provider: 'metamask',
    role: 'primary',
    networks: ['ethereum', 'polygon', 'arbitrum'],
    createdAt: '2026-01-10T10:05:00.000Z',
    updatedAt: '2026-01-10T10:05:00.000Z',
  },
  {
    id: 'wallet-ana-backup',
    userId: 'user-ana',
    label: 'Backup WalletConnect',
    address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    provider: 'walletconnect',
    role: 'secondary',
    networks: ['ethereum', 'base'],
    createdAt: '2026-02-01T09:00:00.000Z',
    updatedAt: '2026-02-01T09:00:00.000Z',
  },
  {
    id: 'wallet-bruno-main',
    userId: 'user-bruno',
    label: 'Coinbase Wallet',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    provider: 'coinbase',
    role: 'primary',
    networks: ['ethereum', 'base'],
    createdAt: '2026-03-02T15:40:00.000Z',
    updatedAt: '2026-03-02T15:40:00.000Z',
  },
]

export const COUPON_FIXTURES: DbCoupon[] = [
  { code: 'JUNGLE10', percentOff: 10, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'WELCOME25', percentOff: 25, expiresAt: '2099-12-31T23:59:59.000Z' },
  { code: 'EXPIRED20', percentOff: 20, expiresAt: '2024-01-01T00:00:00.000Z' },
]

export const FAVORITE_FIXTURES: Record<string, string[]> = {
  'user-ana': ['nft-002', 'nft-007'],
  'user-bruno': [],
}
