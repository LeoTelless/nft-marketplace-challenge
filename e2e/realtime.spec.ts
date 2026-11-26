import { expect, test, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import {
  addToCartViaApi,
  cartLine,
  confirmPurchase,
  fillCheckoutAndReview,
  login,
  main,
  pickEditions,
  reviewDialog,
  summaryTotal,
  USERS,
} from './support/flows.ts'

/**
 * Real-time scenarios. Every change below is made in the simulated backend through
 * `window.__mocks` and reaches the app as a Socket.IO event emitted by the simulated server
 * (consumed by the real `socket.io-client`); nothing touches the app cache or UI directly.
 */

/**
 * Connection state as seen by the simulated Socket.IO server (sockets that completed the handshake).
 * The footer indicator is not used for readiness: under load it can stay on "inativo" while the socket
 * is connected (see the fixme at the end of this file).
 */
const realtimeStatus = (page: Page) => page.getByTestId('realtime-status')
const serverSockets = (page: Page) => page.evaluate(() => window.__mocks!.connectedSockets().map((socket) => socket.userId))
const waitConnected = (page: Page, userId: string | null) => expect.poll(() => serverSockets(page), { timeout: 15_000 }).toContain(userId)
const waitDisconnected = (page: Page) => expect.poll(() => serverSockets(page)).toEqual([])

/** Logged-in Ana with `count` items in the cart. */
async function cartWith(page: Page, scenario: string, count: number) {
  await openWithScenario(page, '/', scenario)
  await login(page, USERS.ana, '/cart')
  const picks = await pickEditions(page, count)
  for (const pick of picks) await addToCartViaApi(page, pick, 1)
  await page.goto('/cart')
  await expect(cartLine(page, picks[0])).toBeVisible()
  await waitConnected(page, USERS.ana.id)
  return picks
}

/** Counts `POST /api/orders` requests. */
function countOrderRequests(page: Page) {
  const counter = { value: 0 }
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') counter.value++
  })
  return counter
}

/** Buys one item with the `order-pending` scenario and returns the pending order id. */
async function placePendingOrder(page: Page) {
  const picks = await cartWith(page, 'order-pending', 1)
  await page.goto('/checkout')
  await fillCheckoutAndReview(page)
  await confirmPurchase(page).click()
  await expect(page).toHaveURL(/\/orders\/[\w-]+$/)
  await expect(main(page).getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()
  return { picks, orderId: page.url().split('/orders/')[1] }
}

test.describe('price and availability pushed by socket (nft.updated)', () => {
  test('the cart explains a price change and updates the summary', async ({ page }) => {
    const [pick] = await cartWith(page, 'instant', 1)
    const before = await summaryTotal(page).textContent()

    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, price: '4.25' }), pick)
    await expect(page.getByText(`O preço de ${pick.nftName} (${pick.editionName}) mudou.`)).toBeVisible()
    await expect(cartLine(page, pick)).toContainText('4.25 ETH')
    await expect(cartLine(page, pick)).toContainText('Preço subiu')
    await expect(summaryTotal(page)).not.toHaveText(before!)
  })

  test('duplicated and stale events do not regress the cart nor change anything else', async ({ page }) => {
    const [first, second] = await cartWith(page, 'instant', 2)
    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, price: '4.25' }), first)
    await expect(cartLine(page, first)).toContainText('4.25 ETH')
    const total = await summaryTotal(page).textContent()
    let requests = 0
    page.on('request', (request) => {
      if (/\/api\/(cart|quote)/.test(new URL(request.url()).pathname)) requests++
    })

    // Same event again (same id) and an older version of the same NFT.
    await page.evaluate((id) => {
      window.__mocks!.replayLastEvent('nft.updated')
      window.__mocks!.emitStaleNftEvent(id)
    }, first.nftId)
    // Events are delivered in order: once this later one shows up, the previous two were processed.
    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, price: '0.5' }), second)
    await expect(cartLine(page, second)).toContainText('0.5 ETH')

    await expect(cartLine(page, first)).toContainText('4.25 ETH')
    await expect(cartLine(page, first)).not.toContainText('Preço caiu')
    await expect(summaryTotal(page)).not.toHaveText(total!)
    // Only the valid event caused a refresh (cart + quote); the replay and the stale event caused none.
    expect(requests).toBeLessThanOrEqual(2)
  })

  test('a sold-out item in the cart is flagged and removes the checkout link until the item is removed', async ({ page }) => {
    const [pick] = await cartWith(page, 'instant', 1)
    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, available: 0 }), pick)

    await expect(page.getByText(`${pick.nftName} (${pick.editionName}) esgotou.`)).toBeVisible()
    await expect(cartLine(page, pick)).toContainText('Esgotado: remova o item para finalizar.')
    await expect(main(page).getByText('Ajuste os itens indisponíveis para finalizar a compra.')).toBeVisible()
    await expect(main(page).getByRole('link', { name: /finalizar/ })).toHaveCount(0)

    await cartLine(page, pick).getByRole('button', { name: /^Remover/ }).click()
    await expect(main(page).getByText('Seu carrinho está vazio.')).toBeVisible()
  })

  test('the checkout review blocks the confirmation when an item sells out meanwhile', async ({ page }) => {
    const [pick] = await cartWith(page, 'instant', 1)
    const orders = countOrderRequests(page)
    await page.goto('/checkout')
    await fillCheckoutAndReview(page)

    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, available: 0 }), pick)
    await expect(page.getByText(`${pick.nftName} (${pick.editionName}) esgotou.`)).toBeVisible()
    await expect(confirmPurchase(page)).toBeDisabled()
    expect(orders.value).toBe(0)
    expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(0)
    await expect(reviewDialog(page)).toBeVisible()
  })

  test('the detail page follows price and availability live', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    const [pick] = await pickEditions(page, 1)
    await page.goto(`/nft/${pick.nftId}?edition=${pick.editionId}`)
    const buy = main(page).getByRole('button', { name: 'Adicionar ao carrinho' })
    await expect(buy).toBeEnabled()
    await waitConnected(page, null)

    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, price: '7.77' }), pick)
    await expect(main(page).getByText('7.77 ETH', { exact: true }).filter({ visible: true })).toBeVisible()

    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, available: 0 }), pick)
    await expect(main(page).getByTestId('edition-availability')).toContainText('esgotada')
    await expect(main(page).getByRole('button', { name: 'Adicionar ao carrinho' })).toBeDisabled()
  })
})

test.describe('order events (order.updated)', () => {
  test('a duplicated confirmation is applied once and a terminal order never changes again', async ({ page }) => {
    const { orderId } = await placePendingOrder(page)

    await page.evaluate((id) => window.__mocks!.resolveOrder(id, 'confirmed'), orderId)
    await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toBeVisible()
    await expect(page.getByText('Pagamento confirmado.')).toHaveCount(1)
    const hash = await main(page).getByTestId('transaction-hash').getAttribute('data-hash')

    // Duplicate delivery, then a refusal attempt on the terminal order: nothing changes.
    await page.evaluate((id) => {
      window.__mocks!.replayLastEvent('order.updated')
      window.__mocks!.resolveOrder(id, 'rejected')
    }, orderId)
    // A later event of another kind proves the previous ones were processed.
    const [other] = await pickEditions(page, 1)
    await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, price: '1.11' }), other)
    await expect(page.getByText('Pagamento confirmado.')).toHaveCount(1)
    await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toBeVisible()
    await expect(main(page).getByRole('heading', { name: 'Pagamento recusado' })).toHaveCount(0)
    await expect(main(page).getByTestId('transaction-hash')).toHaveAttribute('data-hash', hash!)
    const [state] = await page.evaluate(() => window.__mocks!.getState().orders.map((o) => o.order.status))
    expect(state).toBe('confirmed')
  })

  test('a refusal pushed by socket shows the failure and keeps the cart', async ({ page }) => {
    const { orderId, picks } = await placePendingOrder(page)
    await page.evaluate((id) => window.__mocks!.resolveOrder(id, 'rejected'), orderId)
    await expect(main(page).getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible()
    await expect(page.getByText('Pagamento recusado.')).toBeVisible()
    await page.goto('/cart')
    await expect(cartLine(page, picks[0])).toBeVisible()
  })
})

test.describe('connection loss and pending order recovery', () => {
  test('a disconnected socket misses the event; after reconnecting the pending order is reconciled, with no new purchase', async ({ page }) => {
    const orders = countOrderRequests(page)
    const { orderId } = await placePendingOrder(page)
    expect(orders.value).toBe(1)
    await waitConnected(page, USERS.ana.id)

    await page.evaluate(() => window.__mocks!.dropSocket())
    await waitDisconnected(page)
    // Confirmed on the server while the client is offline: the event is lost.
    await page.evaluate((id) => window.__mocks!.resolveOrder(id, 'confirmed'), orderId)
    await expect(main(page).getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()

    await page.evaluate(() => window.__mocks!.restoreSocket())
    await waitConnected(page, USERS.ana.id)
    await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toBeVisible()
    await expect(main(page).getByRole('region', { name: 'Recibo' })).toBeVisible()
    expect(orders.value).toBe(1)
    expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(1)
  })

  test('reloading while the order is pending recovers the same order and later confirmation', async ({ page }) => {
    const orders = countOrderRequests(page)
    const { orderId } = await placePendingOrder(page)

    await page.reload()
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`))
    await expect(main(page).getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()
    await waitConnected(page, USERS.ana.id)

    await page.evaluate((id) => window.__mocks!.resolveOrder(id, 'confirmed'), orderId)
    await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toBeVisible()
    expect(orders.value).toBe(1)
    expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(1)
  })

  test('an order confirmed while the page was closed is shown as confirmed after the reload', async ({ page }) => {
    const { orderId } = await placePendingOrder(page)
    await page.evaluate(() => window.__mocks!.dropSocket())
    await page.evaluate((id) => window.__mocks!.resolveOrder(id, 'confirmed'), orderId)
    await page.reload()
    await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toBeVisible()
    expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(1)
  })

  test('the pending order stays reachable from "Atividade" and from the checkout, without a second order', async ({ page }) => {
    const orders = countOrderRequests(page)
    const { orderId } = await placePendingOrder(page)

    await page.goto('/orders')
    const list = main(page).getByRole('list', { name: 'Pedidos' })
    await expect(list.getByRole('listitem')).toHaveCount(1)
    await list.getByRole('link').first().click()
    await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`))
    expect(orders.value).toBe(1)
  })

  // DEFECT (intermittent, ~4%): after `restoreSocket()` the client sometimes stays on "reconnecting" for 15 s+ with no socket
  // connected on the server, so the catalog is never reconciled (src/shared/realtime/realtime-client.ts reconnection).
  // The same step is part of smoke.spec.ts; the pending-order reconnection test above does not depend on it.
  test.fixme('catalog prices missed while offline are reconciled by REST once the socket is back', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await waitConnected(page, null)
    const card = page.getByTestId('nft-card').first()
    const id = await card.getAttribute('data-nft-id')

    await page.evaluate(() => window.__mocks!.dropSocket())
    await waitDisconnected(page)
    await page.evaluate((nftId) => window.__mocks!.updateNft(nftId, { price: '0.0011' }), id!)
    await page.evaluate(() => window.__mocks!.restoreSocket())
    await expect(card.getByTestId('nft-price')).toHaveText('0.0011 ETH', { timeout: 15_000 })
  })
})


// DEFECT (src/shared/realtime/realtime-client.ts): `connectionId` is taken after `await import('socket.io-client')`.
// On a reload with a session the provider connects twice (token, then token + user); when the two continuations run
// in the opposite order, the discarded connection becomes "latest" and its `destroy()` sets the status to `idle`,
// while the live socket can no longer report. Result: the server has the socket connected but the footer says
// "Tempo real: inativo". Reproduces intermittently under CPU load (6 parallel workers).
test.fixme('the footer indicator says "conectado" after loading a private page with a session', async ({ page }) => {
  await cartWith(page, 'instant', 1)
  await expect(realtimeStatus(page)).toHaveAttribute('data-status', 'connected')
})
