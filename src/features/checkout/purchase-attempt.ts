import type { CreateOrderRequest } from '@/contracts'
import { userStorage } from '@/shared/session/user-storage'

/**
 * One purchase attempt = one `Idempotency-Key` + the exact body sent with it.
 *
 * Persisted per user in `sessionStorage` *before* the request leaves, so that after a timeout,
 * a lost response, a refresh or an expired session the very same request can be re-sent
 * (explicitly, by the user) and the server answers with the order it already created instead
 * of creating a second one. Cleared once the API gave a definitive answer.
 */
export interface PurchaseAttempt {
  key: string
  body: CreateOrderRequest
  createdAt: string
}

const ENTRY = 'purchase-attempt'

export const purchaseAttempts = {
  get(userId: string): PurchaseAttempt | null {
    return userStorage.get<PurchaseAttempt>(userId, ENTRY)
  },
  create(userId: string, body: CreateOrderRequest): PurchaseAttempt {
    const attempt: PurchaseAttempt = { key: `order_${crypto.randomUUID()}`, body, createdAt: new Date().toISOString() }
    userStorage.set(userId, ENTRY, attempt)
    return attempt
  },
  clear(userId: string) {
    userStorage.remove(userId, ENTRY)
  },
}
