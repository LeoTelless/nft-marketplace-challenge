import { expect, test, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import {
  addToCartFromDetail,
  addToCartViaApi,
  cartLine,
  confirmPurchase,
  fillCheckoutAndReview,
  lineQuantity,
  login,
  main,
  pickEditions,
  reviewDialog,
  summaryTotal,
  USERS,
} from './support/flows.ts'

async function startCheckout(page: Page, scenario: string, count = 1) {
  await openWithScenario(page, '/', scenario)
  await login(page, USERS.ana, '/cart')
  const picks = await pickEditions(page, count)
  for (const pick of picks) await addToCartViaApi(page, pick, 1)
  await page.goto('/checkout')
  await fillCheckoutAndReview(page)
  return picks
}

/** Records `POST /api/orders` requests and their idempotency keys. */
function trackOrderRequests(page: Page) {
  const keys: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/orders') {
      keys.push(request.headers()['idempotency-key'] ?? '')
    }
  })
  return keys
}

const reviewTotal = (page: Page) => reviewDialog(page).getByTestId('summary-total')

test('completes a purchase from the detail page: pending, then confirmed; only purchased units leave the cart', async ({ page }) => {
  await openWithScenario(page, '/', 'instant')
  await login(page, USERS.ana, '/')
  const [first, second] = await pickEditions(page, 2)
  await addToCartFromDetail(page, first)
  await addToCartFromDetail(page, second)

  await page.goto('/cart')
  await expect(lineQuantity(page, first)).toHaveText('1')
  await main(page).getByRole('link', { name: 'Conectar e finalizar' }).click()
  await expect(page).toHaveURL(/\/checkout$/)
  await fillCheckoutAndReview(page)
  const total = await reviewTotal(page).textContent()

  await confirmPurchase(page).click()
  await expect(page).toHaveURL(/\/orders\/[\w-]+$/)
  // Pending is never presented as a confirmation.
  await expect(main(page).getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()
  await expect(main(page).getByRole('region', { name: 'Recibo' })).toHaveCount(0)

  // An extra unit added while the order is pending is not part of the purchase.
  await addToCartViaApi(page, first, 1)

  // `order.updated` (socket) turns it into a confirmation with the receipt snapshot.
  await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText('Pagamento confirmado.')).toBeVisible()
  const receipt = main(page).getByRole('region', { name: 'Recibo' })
  await expect(receipt.getByTestId('receipt-total')).toHaveText(total!)
  await expect(main(page).getByTestId('transaction-hash')).toHaveAttribute('data-hash', /^0x[0-9a-f]{64}$/)

  // Later catalog changes do not alter the receipt.
  await page.evaluate((id) => window.__mocks!.updateNft(id, { price: '9.99' }), first.nftId)
  await page.reload()
  await expect(main(page).getByRole('region', { name: 'Recibo' }).getByTestId('receipt-total')).toHaveText(total!)

  await page.goto('/cart')
  await expect(lineQuantity(page, first)).toHaveText('1')
  await expect(cartLine(page, second)).toHaveCount(0)

  // The order is listed in "Atividade".
  await page.goto('/orders')
  await expect(main(page).getByRole('list', { name: 'Pedidos' }).getByRole('listitem')).toHaveCount(1)
  await expect(main(page).getByText('Confirmado')).toBeVisible()
})

test('declined payment shows the refusal and keeps the cart intact', async ({ page }) => {
  const [pick] = await startCheckout(page, 'payment-declined')
  await confirmPurchase(page).click()
  await expect(main(page).getByRole('heading', { name: 'Pagamento recusado' })).toBeVisible({ timeout: 10_000 })
  await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toHaveCount(0)

  await main(page).getByRole('link', { name: 'Voltar ao carrinho' }).click()
  await expect(lineQuantity(page, pick)).toHaveText('1')
})

test('repeated clicks and a lost response recover the same order (retry with the same key)', async ({ page }) => {
  const keys = trackOrderRequests(page)
  await startCheckout(page, 'order-timeout')

  await confirmPurchase(page).dblclick()
  await expect(reviewDialog(page).getByText(/Não recebemos a resposta do servidor/)).toBeVisible()
  expect(keys).toHaveLength(1)

  await reviewDialog(page).getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page).toHaveURL(/\/orders\/[\w-]+$/)
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])

  const orders = await page.evaluate(() => window.__mocks!.getState().orders.map((o) => o.order.id))
  expect(orders).toHaveLength(1)
  expect(page.url()).toContain(orders[0])
})

test('after a lost response and a refresh, the pending attempt is recovered, not duplicated', async ({ page }) => {
  const keys = trackOrderRequests(page)
  await startCheckout(page, 'order-timeout')
  await confirmPurchase(page).click()
  await expect(reviewDialog(page).getByText(/Não recebemos a resposta do servidor/)).toBeVisible()

  await page.reload()
  await main(page).getByRole('button', { name: 'Verificar compra em andamento' }).click()
  await expect(page).toHaveURL(/\/orders\/[\w-]+$/)
  expect(new Set(keys).size).toBe(1)
  expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(1)
})

test('a price change pushed by socket blocks the confirmation until the new values are accepted', async ({ page }) => {
  const [pick] = await startCheckout(page, 'instant')
  const before = await reviewTotal(page).textContent()

  await page.evaluate((p) => window.__mocks!.updateNft(p.nftId, { editionId: p.editionId, price: '3.5' }), pick)
  await expect(page.getByText(`O preço de ${pick.nftName} (${pick.editionName}) mudou.`)).toBeVisible()
  await expect(reviewTotal(page)).not.toHaveText(before!)
  await expect(confirmPurchase(page)).toBeDisabled()

  await reviewDialog(page).getByRole('button', { name: 'Aceitar novos valores' }).click()
  await confirmPurchase(page).click()
  await expect(page).toHaveURL(/\/orders\/[\w-]+$/)
})

test('a price change detected when confirming (409 quote_outdated) requires a new confirmation', async ({ page }) => {
  const keys = trackOrderRequests(page)
  await startCheckout(page, 'price-changed')
  const before = await reviewTotal(page).textContent()

  await confirmPurchase(page).click()
  await expect(reviewDialog(page).getByRole('button', { name: 'Aceitar novos valores' })).toBeVisible()
  await expect(confirmPurchase(page)).toBeDisabled()
  await expect(reviewTotal(page)).not.toHaveText(before!)
  expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(0)

  await reviewDialog(page).getByRole('button', { name: 'Aceitar novos valores' }).click()
  await confirmPurchase(page).click()
  await expect(page).toHaveURL(/\/orders\/[\w-]+$/)
  // A new attempt (new body) uses a new key; exactly one order exists.
  expect(new Set(keys).size).toBe(2)
  expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(1)
})

test('the cart summary follows the API quote and coupons are validated by the API', async ({ page }) => {
  await openWithScenario(page, '/cart', 'instant')
  await expect(main(page).getByText('Seu carrinho está vazio.')).toBeVisible()
  const [pick] = await pickEditions(page, 1)
  await addToCartViaApi(page, pick, 2)
  await page.reload()
  await expect(lineQuantity(page, pick)).toHaveText('2')
  const before = await summaryTotal(page).textContent()

  const coupon = main(page).getByRole('form', { name: 'Cupom' })
  await coupon.getByLabel('Código promocional').fill('EXPIRED20')
  await coupon.getByRole('button', { name: 'Aplicar' }).click()
  await expect(coupon.getByRole('alert')).toHaveText('Este cupom expirou.')
  await coupon.getByLabel('Código promocional').fill('NOPE')
  await coupon.getByRole('button', { name: 'Aplicar' }).click()
  await expect(coupon.getByRole('alert')).toHaveText('Cupom inválido.')
  await coupon.getByLabel('Código promocional').fill('jungle10')
  await coupon.getByRole('button', { name: 'Aplicar' }).click()
  await expect(main(page).getByText(/Cupom JUNGLE10 aplicado/)).toBeVisible()
  await expect(summaryTotal(page)).not.toHaveText(before!)

  await main(page).getByRole('button', { name: 'Remover cupom' }).click()
  await expect(summaryTotal(page)).toHaveText(before!)
})
