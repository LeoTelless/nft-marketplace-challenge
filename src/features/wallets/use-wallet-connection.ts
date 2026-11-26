import { useCallback, useRef, useState } from 'react'
import type { Network, WalletConnection } from '@/contracts'
import { isApiError } from '@/shared/api/api-error'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { walletsApi } from './api'

export type WalletConnectionState =
  | { status: 'disconnected' }
  | { status: 'connecting'; walletId: string; network: Network }
  | { status: 'connected'; connection: WalletConnection }
  /** The user declined in the wallet (`wallet_rejected`) or the network is not supported. */
  | { status: 'rejected'; walletId: string; network: Network; message: string }
  | { status: 'error'; walletId: string; network: Network; message: string }

/**
 * Simulated wallet connection for the checkout (`POST /wallets/:id/connect`).
 * Connecting is per (wallet, network): selecting another wallet or network means the current
 * connection no longer applies (`isConnectedTo` is false) until the user connects again.
 * A late answer for a previous selection is ignored.
 */
export function useWalletConnection() {
  const [state, setState] = useState<WalletConnectionState>({ status: 'disconnected' })
  const attempt = useRef(0)

  const connect = useCallback(async (walletId: string, network: Network) => {
    const id = ++attempt.current
    setState({ status: 'connecting', walletId, network })
    try {
      const connection = await walletsApi.connect(walletId, { network })
      if (id === attempt.current) setState({ status: 'connected', connection })
    } catch (error) {
      if (id !== attempt.current) return
      const rejected = isApiError(error) && (error.code === 'wallet_rejected' || error.isValidation)
      const fieldMessage = isApiError(error) ? error.fieldErrors.network?.[0] : undefined
      setState({
        status: rejected ? 'rejected' : 'error',
        walletId,
        network,
        message: fieldMessage ?? apiErrorMessage(error),
      })
    }
  }, [])

  const disconnect = useCallback(() => {
    attempt.current++
    setState({ status: 'disconnected' })
  }, [])

  const isConnectedTo = useCallback(
    (walletId: string, network: Network) =>
      state.status === 'connected' && state.connection.walletId === walletId && state.connection.network === network,
    [state],
  )

  return { state, connect, disconnect, isConnectedTo }
}
