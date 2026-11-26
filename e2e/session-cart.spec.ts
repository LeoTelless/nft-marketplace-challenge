import { expect, test } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import { addToCartViaApi, cartLine, main, fillCheckoutAndReview, fillLogin, lineQuantity, login, pickEditions, USERS } from './support/flows.ts'

test('visitor cart persists after refresh and is merged into the account on login', async ({ page }) => {
  await openWithScenario(page, '/cart')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()
  const [pick] = await pickEditions(page, 1)
  await addToCartViaApi(page, pick)

  // Persisted on the (simulated) server under the visitor cart id kept in localStorage.
  // (A fresh navigation: reloading the opening URL would reset the mocks.)
  await page.goto('/cart')
  await expect(lineQuantity(page, pick)).toHaveText('1')
  await cartLine(page, pick).getByRole('button', { name: /Aumentar quantidade/ }).click()
  await expect(lineQuantity(page, pick)).toHaveText('2')

  // Checkout requires authentication: login comes back to it.
  await main(page).getByRole('link', { name: 'Finalizar compra' }).click()
  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout/)
  await fillLogin(page, USERS.ana)
  await expect(page).toHaveURL(/\/checkout$/)

  await page.goto('/cart')
  await expect(lineQuantity(page, pick)).toHaveText('2')
  await page.reload()
  await expect(lineQuantity(page, pick)).toHaveText('2')
})

test('favorite removal is optimistic and rolls back when the API fails', async ({ page }) => {
  await openWithScenario(page, '/')
  await login(page, USERS.ana, '/account/favorites')
  const list = main(page).getByRole('list', { name: 'NFTs favoritos' })
  await expect(list.getByRole('listitem')).toHaveCount(2)

  // Optimistic: removed from the list before the (slow) response arrives.
  await page.evaluate(() => window.__mocks!.setScenario('slow'))
  await list.getByRole('button', { name: /dos favoritos/ }).first().click()
  await expect(list.getByRole('listitem')).toHaveCount(1, { timeout: 1_000 })

  // Failure: the remaining favorite disappears, then comes back with an error notice.
  await expect
    .poll(() => page.evaluate(() => window.__mocks!.getState().favorites['user-ana'].length), { timeout: 8_000 })
    .toBe(1)
  await page.evaluate(() => window.__mocks!.setScenario('server-error'))
  await list.getByRole('button', { name: /dos favoritos/ }).click()
  await expect(page.getByText('Não foi possível remover dos favoritos.')).toBeVisible()
  await expect(list.getByRole('listitem')).toHaveCount(1)

  // The server state is the truth after a refresh.
  await page.evaluate(() => window.__mocks!.setScenario('instant'))
  await page.reload()
  await expect(main(page).getByRole('list', { name: 'NFTs favoritos' }).getByRole('listitem')).toHaveCount(1)
})

test('switching users leaks no data, events or storage of the previous user', async ({ page }) => {
  await openWithScenario(page, '/', 'order-pending')
  await login(page, USERS.ana, '/cart')
  const [pick] = await pickEditions(page, 1)
  await addToCartViaApi(page, pick)

  // Ana leaves a pending order behind (resolved later, while Bruno is logged in).
  await page.goto('/checkout')
  await fillCheckoutAndReview(page)
  await main(page).getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(main(page).getByRole('heading', { name: 'Pagamento em processamento' })).toBeVisible()
  const anaOrderId = page.url().split('/orders/')[1]

  await page.goto('/account/wallets')
  await expect(main(page).getByRole('listitem', { name: 'Main MetaMask' })).toBeVisible()

  await page.goto('/account/profile')
  await main(page).getByRole('button', { name: 'Sair' }).click()
  await expect(page).toHaveURL(/\/$/)

  await login(page, USERS.bruno, '/account/wallets')
  const wallets = main(page).getByRole('list', { name: 'Suas carteiras' })
  await expect(wallets.getByRole('listitem', { name: 'Coinbase Wallet' })).toBeVisible()
  await expect(page.getByText('Main MetaMask')).toHaveCount(0)

  await page.goto('/account/favorites')
  await expect(page.getByText('Você ainda não favoritou nenhum NFT.')).toBeVisible()
  await page.goto('/cart')
  await expect(page.getByText('Seu carrinho está vazio.')).toBeVisible()

  // Only Bruno's socket (or visitors) remain connected; Ana's order event never reaches Bruno.
  await expect.poll(() => page.evaluate(() => window.__mocks!.connectedSockets().map((s) => s.userId))).toEqual([USERS.bruno.id])
  await page.evaluate((id) => window.__mocks!.resolveOrder(id, 'confirmed'), anaOrderId)
  await page.waitForTimeout(500)
  await expect(page.getByText('Pagamento confirmado.')).toHaveCount(0)
  const response = await page.goto(`/orders/${anaOrderId}`)
  expect(response?.ok()).toBe(true)
  await expect(main(page).getByRole('heading', { name: 'Compra confirmada' })).toHaveCount(0)
  await expect(main(page).getByRole('alert').filter({ hasText: 'permissão' })).toBeVisible()

  const leftovers = await page.evaluate(() =>
    Object.keys(sessionStorage).filter((key) => key.startsWith('nft.user.user-ana')),
  )
  expect(leftovers).toEqual([])
})

test('session expiring during checkout resumes the checkout after logging in again', async ({ page }) => {
  await openWithScenario(page, '/')
  await login(page, USERS.ana, '/cart')
  const [pick] = await pickEditions(page, 1)
  await addToCartViaApi(page, pick)

  await page.goto('/checkout')
  await main(page).getByLabel('Nome de usuário').fill('ana.souza')
  await main(page).getByLabel('Observação do colecionador (opcional)').fill('Presente de aniversário')

  await page.evaluate(() => window.__mocks!.expireSessions())
  await main(page).getByRole('button', { name: 'Conectar carteira' }).click()

  await expect(page).toHaveURL(/\/login\?redirect=%2Fcheckout&reason=expired/)
  await expect(page.getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.')).toBeVisible()
  await fillLogin(page, USERS.ana)

  await expect(page).toHaveURL(/\/checkout$/)
  await expect(main(page).getByLabel('Nome de usuário')).toHaveValue('ana.souza')
  await expect(main(page).getByLabel('Observação do colecionador (opcional)')).toHaveValue('Presente de aniversário')
  await expect(main(page).getByRole('region', { name: 'Seus NFTs' })).toContainText(pick.nftName)
})
