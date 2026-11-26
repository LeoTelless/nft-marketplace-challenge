import {
  endpoints,
  walletConnectionSchema,
  walletListSchema,
  walletSchema,
  type ConnectWalletRequest,
  type CreateWalletRequest,
  type UpdateWalletRequest,
} from '@/contracts'
import { request, requestVoid, type RequestOptions } from '@/shared/api/http'

export const walletsApi = {
  list: (options?: RequestOptions) => request(walletListSchema, { url: endpoints.wallets, ...options }),
  create: (body: CreateWalletRequest) => request(walletSchema, { method: 'POST', url: endpoints.wallets, data: body }),
  update: (id: string, body: UpdateWalletRequest) =>
    request(walletSchema, { method: 'PATCH', url: endpoints.wallet(id), data: body }),
  connect: (id: string, body: ConnectWalletRequest) =>
    request(walletConnectionSchema, { method: 'POST', url: endpoints.walletConnect(id), data: body }),
  disconnect: (id: string) => requestVoid({ method: 'DELETE', url: endpoints.walletConnect(id) }),
}
