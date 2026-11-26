import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore, type ReactNode } from 'react'
import { connectRealtime, realtimeStatus } from './realtime-client'

/**
 * Owns the socket lifecycle: one connection per (token, userId). Changing either
 * (login, logout, user switch) destroys the previous socket and its listeners
 * before a new one is created.
 */
export function RealtimeProvider({
  token,
  userId,
  children,
}: {
  token: string | null
  userId: string | null
  children: ReactNode
}) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const connection = connectRealtime({ queryClient, token, userId })
    return () => connection.destroy()
  }, [queryClient, token, userId])

  return children
}

export function useRealtimeStatus() {
  return useSyncExternalStore(realtimeStatus.subscribe, realtimeStatus.get, realtimeStatus.get)
}
