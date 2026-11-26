import { z } from 'zod'
import { idSchema, isoDateSchema, networkSchema } from './common'

export const walletProviderSchema = z.enum(['metamask', 'walletconnect', 'coinbase'])
export type WalletProvider = z.infer<typeof walletProviderSchema>
/** One primary and at most one secondary wallet per user. */
export const walletRoleSchema = z.enum(['primary', 'secondary'])
export type WalletRole = z.infer<typeof walletRoleSchema>
export const walletAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Endereço de carteira inválido (0x + 40 caracteres hexadecimais)')

export const walletSchema = z.object({
  id: idSchema,
  label: z.string(),
  address: walletAddressSchema,
  provider: walletProviderSchema,
  role: walletRoleSchema,
  networks: z.array(networkSchema).min(1),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})
export type Wallet = z.infer<typeof walletSchema>

/** `GET /wallets` (auth). */
export const walletListSchema = z.object({ items: z.array(walletSchema) })
export type WalletList = z.infer<typeof walletListSchema>

/** `POST /wallets` returns Wallet (201). 409 `wallet_conflict` when the role slot or the address is taken. */
export const createWalletRequestSchema = z.object({
  label: z.string().trim().min(1, 'Informe o apelido da carteira').max(40, 'Use no máximo 40 caracteres'),
  address: walletAddressSchema,
  provider: walletProviderSchema,
  role: walletRoleSchema,
  networks: z.array(networkSchema, 'Selecione ao menos uma rede').min(1, 'Selecione ao menos uma rede'),
})
export type CreateWalletRequest = z.infer<typeof createWalletRequestSchema>

/** `PATCH /wallets/:id` returns Wallet. Promoting to `primary` demotes the current primary to `secondary`. */
export const updateWalletRequestSchema = createWalletRequestSchema.partial()
export type UpdateWalletRequest = z.infer<typeof updateWalletRequestSchema>

/** `POST /wallets/:id/connect`: simulated wallet connection. 422 `wallet_rejected` when the user declines. */
export const connectWalletRequestSchema = z.object({ network: networkSchema })
export type ConnectWalletRequest = z.infer<typeof connectWalletRequestSchema>
export const walletConnectionSchema = z.object({
  walletId: idSchema,
  network: networkSchema,
  connectedAt: isoDateSchema,
})
export type WalletConnection = z.infer<typeof walletConnectionSchema>
