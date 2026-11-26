import type { Cart, CartItem, Network, Order, QuoteIssue, QuoteLine } from '@/contracts'
import { addEth, multiplyEth, percentOfEth, subtractEth } from '@/shared/lib/eth'
import { hashString, MockHttpError, now, randomHex, stableStringify } from '../handlers/utils'
import { ORDER_RESOLUTION_DELAY_MS } from '../scenarios'
import { announceOrder, db, findNft, mutateNft, mutateOrder, nextId, persist } from './store'
import { NETWORK_FEES, type DbCart, type DbOrder, type DbQuote } from './types'

const QUOTE_TTL_MS = 10 * 60_000

// ---------------------------------------------------------------- carts

export function getOrCreateCart(owner: { userId: string } | { guestCartId: string }): DbCart {
  const state = db()
  if ('userId' in owner) {
    let cart = state.carts.find((c) => c.userId === owner.userId)
    if (!cart) {
      cart = { id: nextId('cart'), userId: owner.userId, lines: [], updatedAt: now(), version: 1 }
      state.carts.push(cart)
      persist()
    }
    return cart
  }
  let cart = state.carts.find((c) => c.id === owner.guestCartId && c.userId === null)
  if (!cart) {
    cart = { id: owner.guestCartId, userId: null, lines: [], updatedAt: now(), version: 1 }
    state.carts.push(cart)
    persist()
  }
  return cart
}

export function touchCart(cart: DbCart) {
  cart.version += 1
  cart.updatedAt = now()
  persist()
}

export function findEdition(nftId: string, editionId: string) {
  const nft = findNft(nftId)
  const edition = nft?.editions.find((e) => e.id === editionId)
  return nft && edition ? { nft, edition } : null
}

export function cartView(cart: DbCart): Cart {
  const items: CartItem[] = []
  for (const line of cart.lines) {
    const found = findEdition(line.nftId, line.editionId)
    if (!found) continue
    items.push({
      id: line.id,
      nftId: line.nftId,
      editionId: line.editionId,
      quantity: line.quantity,
      nftName: found.nft.name,
      editionName: found.edition.name,
      imageUrl: found.nft.images[0].url,
      unitPrice: found.edition.price,
      addedUnitPrice: line.addedUnitPrice,
      available: found.edition.available,
      maxPerOrder: found.edition.maxPerOrder,
    })
  }
  return { id: cart.id, items, updatedAt: cart.updatedAt, version: cart.version }
}

/** Adds (or increases) a line, enforcing availability and the per-order limit. */
export function addToCart(cart: DbCart, nftId: string, editionId: string, quantity: number) {
  const found = findEdition(nftId, editionId)
  if (!found) throw new MockHttpError(404, 'not_found', 'NFT or edition not found')
  const existing = cart.lines.find((l) => l.nftId === nftId && l.editionId === editionId)
  const requested = (existing?.quantity ?? 0) + quantity
  assertAvailable(nftId, editionId, requested)
  if (existing) existing.quantity = requested
  else cart.lines.push({ id: nextId('line'), nftId, editionId, quantity, addedUnitPrice: found.edition.price })
  touchCart(cart)
}

export function assertAvailable(nftId: string, editionId: string, requested: number) {
  const found = findEdition(nftId, editionId)
  if (!found) throw new MockHttpError(404, 'not_found', 'NFT or edition not found')
  const limit = Math.min(found.edition.available, found.edition.maxPerOrder)
  if (requested > limit) {
    throw new MockHttpError(
      409,
      'availability_conflict',
      found.edition.available === 0
        ? `${found.nft.name} (${found.edition.name}) está esgotado`
        : `Só é possível comprar ${limit} unidade(s) de ${found.nft.name} (${found.edition.name})`,
      { details: { issues: [{ nftId, editionId, requested, available: limit }] } },
    )
  }
}

/** Visitor cart merged into the account cart on login/register (quantities summed, capped). */
export function mergeGuestCart(guestCartId: string | null | undefined, userId: string) {
  if (!guestCartId) return
  const state = db()
  const guest = state.carts.find((c) => c.id === guestCartId && c.userId === null)
  if (!guest) return
  const target = getOrCreateCart({ userId })
  for (const line of guest.lines) {
    const found = findEdition(line.nftId, line.editionId)
    if (!found) continue
    const cap = Math.max(Math.min(found.edition.available, found.edition.maxPerOrder), 1)
    const existing = target.lines.find((l) => l.nftId === line.nftId && l.editionId === line.editionId)
    if (existing) existing.quantity = Math.min(existing.quantity + line.quantity, cap)
    else target.lines.push({ ...line, id: nextId('line'), quantity: Math.min(line.quantity, cap) })
  }
  state.carts = state.carts.filter((c) => c !== guest)
  touchCart(target)
}

// ---------------------------------------------------------------- quotes

export function resolveCoupon(code: string | undefined | null) {
  if (!code) return null
  const coupon = db().coupons.find((c) => c.code.toLowerCase() === code.trim().toLowerCase())
  if (!coupon) {
    throw new MockHttpError(422, 'coupon_invalid', 'This coupon does not exist', {
      fieldErrors: { couponCode: ['Cupom inválido'] },
    })
  }
  if (Date.parse(coupon.expiresAt) <= Date.now()) {
    throw new MockHttpError(422, 'coupon_expired', 'This coupon has expired', {
      fieldErrors: { couponCode: ['Este cupom expirou'] },
    })
  }
  return { code: coupon.code, percentOff: coupon.percentOff }
}

/** Computes (and stores) the authoritative quote for a cart. */
export function computeQuote(cart: DbCart, couponCode: string | null, network: Network): DbQuote {
  const coupon = resolveCoupon(couponCode)
  const view = cartView(cart)
  const lines: QuoteLine[] = view.items.map((item) => ({
    nftId: item.nftId,
    editionId: item.editionId,
    nftName: item.nftName,
    editionName: item.editionName,
    imageUrl: item.imageUrl,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: multiplyEth(item.unitPrice, item.quantity),
    available: item.available,
  }))
  const issues: QuoteIssue[] = []
  for (const item of view.items) {
    if (item.available === 0) {
      issues.push({ type: 'sold_out', nftId: item.nftId, editionId: item.editionId, message: `${item.nftName} (${item.editionName}) está esgotado` })
    } else if (item.quantity > item.available) {
      issues.push({
        type: 'insufficient_availability',
        nftId: item.nftId,
        editionId: item.editionId,
        message: `Restam apenas ${item.available} unidade(s) de ${item.nftName} (${item.editionName})`,
      })
    }
  }

  const subtotal = addEth(...lines.map((l) => l.lineTotal))
  const discount = coupon ? percentOfEth(subtotal, coupon.percentOff) : '0'
  const networkFee = lines.length > 0 ? NETWORK_FEES[network] : '0'
  const total = addEth(subtractEth(subtotal, discount), networkFee)
  const fingerprint = hashString(
    stableStringify({
      lines: lines.map((l) => [l.nftId, l.editionId, l.quantity, l.unitPrice]),
      coupon,
      network,
      networkFee,
    }),
  )

  const createdAt = new Date()
  const quote: DbQuote = {
    id: nextId('quote'),
    fingerprint,
    cartVersion: cart.version,
    lines,
    coupon,
    network,
    subtotal,
    discount,
    networkFee,
    total,
    issues,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + QUOTE_TTL_MS).toISOString(),
    cartId: cart.id,
    userId: cart.userId,
    couponCode: coupon?.code ?? null,
  }
  db().quotes.push(quote)
  persist()
  return quote
}

export function publicQuote(quote: DbQuote) {
  const { cartId: _cartId, userId: _userId, couponCode: _couponCode, ...rest } = quote
  return rest
}

// ---------------------------------------------------------------- orders

const timers = new Map<string, ReturnType<typeof setTimeout>>()

export function reserveStock(lines: Array<{ nftId: string; editionId: string; quantity: number }>, sign: 1 | -1) {
  const byNft = new Map<string, typeof lines>()
  for (const line of lines) byNft.set(line.nftId, [...(byNft.get(line.nftId) ?? []), line])
  for (const [nftId, nftLines] of byNft) {
    mutateNft(nftId, (draft) => {
      for (const line of nftLines) {
        const edition = draft.editions.find((e) => e.id === line.editionId)
        if (edition) edition.available = Math.max(0, Math.min(edition.supply, edition.available - sign * line.quantity))
      }
    })
  }
}

export function createPendingOrder(input: Omit<DbOrder, 'order'> & { orderData: Omit<Order, 'id' | 'version' | 'createdAt' | 'updatedAt' | 'status' | 'transaction' | 'rejectionReason'> }) {
  const { orderData, ...record } = input
  const createdAt = now()
  const order: Order = {
    id: nextId('order'),
    status: 'pending',
    ...orderData,
    transaction: null,
    rejectionReason: null,
    createdAt,
    updatedAt: createdAt,
    version: 1,
  }
  reserveStock(record.reserved, 1)
  const dbOrder: DbOrder = { ...record, order }
  db().orders.push(dbOrder)
  persist()
  announceOrder(order, record.userId)
  scheduleResolution(dbOrder)
  return dbOrder
}

export function scheduleResolution(record: DbOrder) {
  if (record.resolveAt === null || record.order.status !== 'pending') return
  clearTimeout(timers.get(record.order.id))
  const wait = Math.max(0, record.resolveAt - Date.now())
  timers.set(
    record.order.id,
    setTimeout(() => resolveOrder(record.order.id, record.plannedOutcome), wait),
  )
}

/** Resolves a pending order. Terminal orders are left untouched (returns the current order). */
export function resolveOrder(orderId: string, outcome: 'confirmed' | 'rejected'): Order {
  const record = db().orders.find((o) => o.order.id === orderId)
  if (!record) throw new Error(`Order ${orderId} not found`)
  clearTimeout(timers.get(orderId))
  timers.delete(orderId)
  if (record.order.status !== 'pending') return record.order

  if (outcome === 'rejected') {
    reserveStock(record.reserved, -1)
    return mutateOrder(orderId, (draft) => {
      draft.status = 'rejected'
      draft.rejectionReason = 'Pagamento recusado pela carteira (simulado)'
    })
  }

  removePurchasedFromCart(record)
  const hash = `0x${randomHex(32)}`
  return mutateOrder(orderId, (draft) => {
    draft.status = 'confirmed'
    draft.transaction = { hash, explorerUrl: `https://etherscan.io/tx/${hash}` }
  })
}

/** After confirmation only the purchased quantities leave the cart. */
function removePurchasedFromCart(record: DbOrder) {
  const cart = db().carts.find((c) => c.id === record.cartId)
  if (!cart) return
  for (const bought of record.reserved) {
    const line = cart.lines.find((l) => l.nftId === bought.nftId && l.editionId === bought.editionId)
    if (line) line.quantity -= bought.quantity
  }
  cart.lines = cart.lines.filter((l) => l.quantity > 0)
  touchCart(cart)
}

/** On mock start: resume timers of orders still pending (e.g. after a page refresh). */
export function resumePendingOrders() {
  for (const record of db().orders) scheduleResolution(record)
}

export function clearOrderTimers() {
  for (const timer of timers.values()) clearTimeout(timer)
  timers.clear()
}

export function resolutionTime(): number {
  return Date.now() + ORDER_RESOLUTION_DELAY_MS
}
