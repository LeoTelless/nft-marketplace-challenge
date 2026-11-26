import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { createWalletRequestSchema, type UpdateWalletRequest, type Wallet, type WalletList } from '@/contracts'
import { useSession } from '@/features/auth/session'
import { queryKeys } from '@/shared/api/query-keys'
import { notify } from '@/shared/feedback/notifications'
import { walletsApi } from './api'

export const walletFormSchema = createWalletRequestSchema
export type WalletFormValues = z.infer<typeof walletFormSchema>
export const WALLET_FIELDS = ['label', 'address', 'provider', 'role', 'networks'] as const

export const PROVIDER_LABELS: Record<Wallet['provider'], string> = {
  walletconnect: 'WalletConnect',
  metamask: 'MetaMask',
  coinbase: 'Coinbase Wallet',
}

function useUserId() {
  return useSession().user?.id ?? null
}

/** Wallets of the current user, primary first. */
export function useWallets() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.user.wallets(userId ?? ''),
    queryFn: ({ signal }) => walletsApi.list({ signal }),
    enabled: userId !== null,
    select: (list: WalletList) => ({
      items: list.items,
      primary: list.items.find((w) => w.role === 'primary') ?? null,
      secondary: list.items.find((w) => w.role === 'secondary') ?? null,
    }),
  })
}

/** Errors (`ApiError`: 409 `wallet_conflict`, 422 field errors) are mapped by the form. */
export function useCreateWallet() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: (values: WalletFormValues) => walletsApi.create(values),
    onSuccess: (wallet) => {
      notify({ tone: 'success', title: `Carteira ${wallet.label} adicionada.`, key: 'wallets' })
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.user.wallets(userId) })
    },
  })
}

/** Update fields, or promote to primary (`{ role: 'primary' }`: the server swaps the roles). */
export function useUpdateWallet() {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateWalletRequest & { id: string }) => walletsApi.update(id, body),
    onSuccess: (wallet, vars) => {
      notify({
        tone: 'success',
        title: vars.role === 'primary' ? `${wallet.label} agora é a carteira principal.` : `Carteira ${wallet.label} atualizada.`,
        key: 'wallets',
      })
      if (userId) void queryClient.invalidateQueries({ queryKey: queryKeys.user.wallets(userId) })
    },
  })
}
