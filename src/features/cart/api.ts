import {
  cartSchema,
  endpoints,
  quoteSchema,
  type AddCartItemRequest,
  type QuoteRequest,
  type UpdateCartItemRequest,
} from '@/contracts'
import { request, type RequestOptions } from '@/shared/api/http'

export const cartApi = {
  get: (options?: RequestOptions) => request(cartSchema, { url: endpoints.cart, ...options }),
  addItem: (body: AddCartItemRequest) => request(cartSchema, { method: 'POST', url: endpoints.cartItems, data: body }),
  updateItem: (itemId: string, body: UpdateCartItemRequest) =>
    request(cartSchema, { method: 'PATCH', url: endpoints.cartItem(itemId), data: body }),
  removeItem: (itemId: string) => request(cartSchema, { method: 'DELETE', url: endpoints.cartItem(itemId) }),
  quote: (body: QuoteRequest, options?: RequestOptions) =>
    request(quoteSchema, { method: 'POST', url: endpoints.quotes, data: body, ...options }),
}
