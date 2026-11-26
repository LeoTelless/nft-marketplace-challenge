import { http, HttpResponse } from 'msw'
import { createOrderRequestSchema, endpoints, HEADERS, type OrderList } from '@/contracts'
import { percentOfEth } from '@/shared/lib/eth'
import { computeQuote, createPendingOrder, getOrCreateCart, publicQuote, resolutionTime } from '../db/commerce'
import { db, mutateNft } from '../db/store'
import { consumeOneShot, is } from '../scenarios'
import { api, hashString, MockHttpError, parseBody, requireUser, route, stableStringify, validationError } from './utils'

export const orderHandlers = [
  http.post(
    api(endpoints.orders),
    route(
      async (ctx) => {
        const user = requireUser(ctx)
        const key = ctx.request.headers.get(HEADERS.idempotencyKey)
        if (!key || key.length < 8 || key.length > 128) {
          throw new MockHttpError(400, 'idempotency_key_required', `Header ${HEADERS.idempotencyKey} is required`)
        }
        const body = await parseBody(ctx.request, createOrderRequestSchema)
        const requestHash = hashString(stableStringify(body))
        const state = db()

        // Idempotency: same key → same order; same key with another body → conflict.
        const existing = state.orders.find((o) => o.userId === user.id && o.idempotencyKey === key)
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new MockHttpError(409, 'idempotency_conflict', 'This idempotency key was already used with a different request')
          }
          return HttpResponse.json(existing.order, { status: 200 })
        }

        if (is('validation-error')) validationError({ 'collector.fullName': ['Name does not match the wallet owner (simulated)'] })

        const cart = getOrCreateCart({ userId: user.id })
        const firstLine = cart.lines[0]
        // Scenario hooks: the catalog changes *during* the purchase, through the regular
        // db mutation path (so `nft.updated` is emitted too).
        if (firstLine && consumeOneShot('price-changed')) {
          mutateNft(firstLine.nftId, (draft) => {
            const edition = draft.editions.find((e) => e.id === firstLine.editionId)
            if (edition) edition.price = percentOfEth(edition.price, 115)
          })
        }
        if (firstLine && consumeOneShot('sold-out')) {
          mutateNft(firstLine.nftId, (draft) => {
            const edition = draft.editions.find((e) => e.id === firstLine.editionId)
            if (edition) edition.available = 0
          })
        }

        const original = state.quotes.find((q) => q.id === body.quoteId && q.userId === user.id)
        const fresh = computeQuote(cart, original?.couponCode ?? null, body.network)
        if (fresh.lines.length === 0) validationError({ _: ['Your cart is empty'] }, 'Your cart is empty')
        if (fresh.issues.length > 0) {
          throw new MockHttpError(409, 'availability_conflict', 'Some items are no longer available', {
            details: { issues: fresh.issues, quote: publicQuote(fresh) },
          })
        }
        const expired = !original || Date.parse(original.expiresAt) <= Date.now()
        if (expired || fresh.fingerprint !== body.quoteFingerprint) {
          throw new MockHttpError(409, 'quote_outdated', 'Prices, availability or fees changed. Review the new total.', {
            details: { quote: publicQuote(fresh) },
          })
        }

        const wallet = state.wallets.find((w) => w.id === body.walletId && w.userId === user.id)
        if (!wallet) validationError({ walletId: ['Select one of your wallets'] })
        if (!wallet.networks.includes(body.network)) {
          validationError({ network: [`${wallet.label} does not support ${body.network}`] })
        }

        const record = createPendingOrder({
          userId: user.id,
          cartId: cart.id,
          idempotencyKey: key,
          requestHash,
          resolveAt: is('order-pending') ? null : resolutionTime(),
          plannedOutcome: is('payment-declined') ? 'rejected' : 'confirmed',
          reserved: fresh.lines.map((l) => ({ nftId: l.nftId, editionId: l.editionId, quantity: l.quantity })),
          orderData: {
            receipt: {
              lines: fresh.lines,
              coupon: fresh.coupon,
              subtotal: fresh.subtotal,
              discount: fresh.discount,
              networkFee: fresh.networkFee,
              total: fresh.total,
              network: body.network,
              walletAddress: wallet.address,
              collector: body.collector,
            },
          },
        })

        // The order exists, but the client never gets the answer: it must retry with the same key.
        if (consumeOneShot('order-timeout')) return HttpResponse.error()

        return HttpResponse.json(record.order, { status: 201 })
      },
      { auth: true },
    ),
  ),

  http.get(
    api(endpoints.orders),
    route(
      (ctx) => {
        const user = requireUser(ctx)
        const items = db()
          .orders.filter((o) => o.userId === user.id)
          .map((o) => o.order)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        return HttpResponse.json({ items } satisfies OrderList)
      },
      { auth: true },
    ),
  ),

  http.get(
    api(endpoints.order(':id')),
    route<{ id: string }>(
      (ctx) => {
        const user = requireUser(ctx)
        const record = db().orders.find((o) => o.order.id === ctx.params.id)
        if (!record) throw new MockHttpError(404, 'not_found', 'Order not found')
        if (record.userId !== user.id) throw new MockHttpError(403, 'forbidden', 'This order belongs to another account')
        return HttpResponse.json(record.order)
      },
      { auth: true },
    ),
  ),
]
