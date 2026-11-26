import { http, HttpResponse } from 'msw'
import {
  addCartItemRequestSchema,
  endpoints,
  HEADERS,
  quoteRequestSchema,
  updateCartItemRequestSchema,
  type Favorites,
} from '@/contracts'
import { addToCart, assertAvailable, cartView, computeQuote, getOrCreateCart, publicQuote, touchCart } from '../db/commerce'
import { db, findNft, persist } from '../db/store'
import type { DbCart, DbUser } from '../db/types'
import { is } from '../scenarios'
import { api, MockHttpError, parseBody, requireUser, route } from './utils'

function resolveCart(request: Request, user: DbUser | null): DbCart {
  if (user) return getOrCreateCart({ userId: user.id })
  const guestCartId = request.headers.get(HEADERS.cartId)
  if (!guestCartId || !/^guest_[\w-]{8,64}$/.test(guestCartId)) {
    throw new MockHttpError(400, 'bad_request', `Missing or invalid ${HEADERS.cartId} header`)
  }
  return getOrCreateCart({ guestCartId })
}

function findLine(cart: DbCart, itemId: string) {
  const line = cart.lines.find((l) => l.id === itemId)
  if (!line) throw new MockHttpError(404, 'not_found', 'Cart item not found')
  return line
}

export const cartHandlers = [
  http.get(
    api(endpoints.cart),
    route(({ request, user }) => HttpResponse.json(cartView(resolveCart(request, user)))),
  ),

  http.post(
    api(endpoints.cartItems),
    route(async ({ request, user }) => {
      const body = await parseBody(request, addCartItemRequestSchema)
      const cart = resolveCart(request, user)
      addToCart(cart, body.nftId, body.editionId, body.quantity)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.patch(
    api(endpoints.cartItem(':itemId')),
    route<{ itemId: string }>(async ({ request, params, user }) => {
      const body = await parseBody(request, updateCartItemRequestSchema)
      const cart = resolveCart(request, user)
      const line = findLine(cart, params.itemId)
      if (body.quantity > line.quantity) assertAvailable(line.nftId, line.editionId, body.quantity)
      line.quantity = body.quantity
      touchCart(cart)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.delete(
    api(endpoints.cartItem(':itemId')),
    route<{ itemId: string }>(({ request, params, user }) => {
      const cart = resolveCart(request, user)
      findLine(cart, params.itemId)
      cart.lines = cart.lines.filter((l) => l.id !== params.itemId)
      touchCart(cart)
      return HttpResponse.json(cartView(cart))
    }),
  ),

  http.post(
    api(endpoints.quotes),
    route(async ({ request, user }) => {
      const body = await parseBody(request, quoteRequestSchema)
      if (body.couponCode && is('coupon-invalid')) {
        throw new MockHttpError(422, 'coupon_invalid', 'This coupon does not exist', {
          fieldErrors: { couponCode: ['Cupom inválido'] },
        })
      }
      if (body.couponCode && is('coupon-expired')) {
        throw new MockHttpError(422, 'coupon_expired', 'This coupon has expired', {
          fieldErrors: { couponCode: ['Este cupom expirou'] },
        })
      }
      const quote = computeQuote(resolveCart(request, user), body.couponCode ?? null, body.network)
      return HttpResponse.json(publicQuote(quote))
    }),
  ),
]

export const favoritesHandlers = [
  http.get(
    api(endpoints.favorites),
    route(
      (ctx) => {
        const user = requireUser(ctx)
        const body: Favorites = { nftIds: db().favorites[user.id] ?? [] }
        return HttpResponse.json(body)
      },
      { auth: true },
    ),
  ),

  http.put(
    api(endpoints.favorite(':nftId')),
    route<{ nftId: string }>(
      (ctx) => {
        const user = requireUser(ctx)
        if (!findNft(ctx.params.nftId)) throw new MockHttpError(404, 'not_found', 'NFT not found')
        const current = db().favorites[user.id] ?? []
        if (!current.includes(ctx.params.nftId)) db().favorites[user.id] = [...current, ctx.params.nftId]
        persist()
        return HttpResponse.json({ nftIds: db().favorites[user.id] } satisfies Favorites)
      },
      { auth: true },
    ),
  ),

  http.delete(
    api(endpoints.favorite(':nftId')),
    route<{ nftId: string }>(
      (ctx) => {
        const user = requireUser(ctx)
        db().favorites[user.id] = (db().favorites[user.id] ?? []).filter((id) => id !== ctx.params.nftId)
        persist()
        return HttpResponse.json({ nftIds: db().favorites[user.id] } satisfies Favorites)
      },
      { auth: true },
    ),
  ),
]
