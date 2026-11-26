import { endpoints, HEADERS, orderListSchema, orderSchema, type CreateOrderRequest } from '@/contracts'
import { request, type RequestOptions } from '@/shared/api/http'

export const ordersApi = {
  /**
   * Never retried automatically. The caller keeps one `idempotencyKey` per purchase attempt
   * (persisted in sessionStorage) and re-sends it after a timeout to recover the same order.
   */
  create: (body: CreateOrderRequest, idempotencyKey: string) =>
    request(orderSchema, {
      method: 'POST',
      url: endpoints.orders,
      data: body,
      headers: { [HEADERS.idempotencyKey]: idempotencyKey },
      timeout: 10_000,
    }),
  list: (options?: RequestOptions) => request(orderListSchema, { url: endpoints.orders, ...options }),
  detail: (id: string, options?: RequestOptions) => request(orderSchema, { url: endpoints.order(id), ...options }),
}
