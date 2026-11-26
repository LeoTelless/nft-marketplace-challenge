import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { TERMINAL_ORDER_STATUSES, type Order } from '@/contracts'
import { queryKeys } from '@/shared/api/query-keys'
import { useCurrentUser } from '@/features/auth/session'
import { ordersApi } from './api'

/**
 * Order detail. Its state changes through `order.updated` (applied to this same cache entry by
 * the realtime client) and is reconciled by REST on mount, refresh and socket reconnection.
 * A REST answer never regresses a newer version already received by socket.
 */
export function orderQueryOptions(queryClient: QueryClient, userId: string, orderId: string) {
  const queryKey = queryKeys.user.order(userId, orderId)
  return queryOptions({
    queryKey,
    queryFn: async ({ signal }) => {
      const fresh = await ordersApi.detail(orderId, { signal })
      const current = queryClient.getQueryData<Order>(queryKey)
      return current && current.version > fresh.version ? current : fresh
    },
  })
}

export const PENDING_ORDER_POLL_MS = 3_000

export function isTerminalOrder(order: Pick<Order, 'status'>): boolean {
  return TERMINAL_ORDER_STATUSES.includes(order.status)
}

export function useOrder(orderId: string) {
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  return useQuery({
    ...orderQueryOptions(queryClient, user?.id ?? '', orderId),
    enabled: Boolean(user),
    // Safety net independent of the socket: while the order is pending, poll REST every 3 s
    // (stops on `confirmed`/`rejected`), so a missed `order.updated` never leaves it stuck.
    refetchInterval: (query) => (query.state.data?.status === 'pending' ? PENDING_ORDER_POLL_MS : false),
  })
}

export function useOrders() {
  const user = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.user.orders(user?.id ?? ''),
    queryFn: ({ signal }) => ordersApi.list({ signal }),
    enabled: Boolean(user),
  })
}
