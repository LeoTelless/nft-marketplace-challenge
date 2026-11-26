import { expect, test, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import { addToCartViaApi, login, main, pickEditions, summaryTotal, USERS } from './support/flows.ts'

/**
 * Visual regression of the four reference screens (Início, Detalhe, Carrinho, Pagamento), on desktop
 * and mobile (one baseline per project). Stable data: default fixtures (deterministic, 48 NFTs),
 * the `instant` scenario (no latency, no skeletons), a frozen wall clock, reduced motion and
 * disabled animations, the app font loaded, every image decoded. Only the realtime connection
 * label (it depends on handshake timing) is masked.
 *
 * Update the baselines with `npm run test:visual:update` after an intentional UI change.
 */
const FIXED_TIME = new Date('2026-06-01T12:00:00.000Z')

test.use({ reducedMotion: 'reduce', colorScheme: 'dark' })

async function stabilize(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  // Below-the-fold images are lazy: load them all so the full-page capture is complete.
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((img) => img.setAttribute('loading', 'eager')))
  await expect
    .poll(() => page.evaluate(() => [...document.images].every((img) => img.complete && (img.naturalWidth > 0 || !img.currentSrc))))
    .toBe(true)
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => undefined))))
  // Anything toasting or loading would make the capture non-deterministic.
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
}

const shot = (page: Page, name: string) =>
  expect(page).toHaveScreenshot(`${name}.png`, {
    fullPage: true,
    animations: 'disabled',
    caret: 'hide',
    mask: [page.getByTestId('realtime-status')],
  })

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(FIXED_TIME)
})

test('visual: home', async ({ page }) => {
  await openWithScenario(page, '/', 'instant')
  await expect(page.getByTestId('nft-card')).toHaveCount(9)
  await stabilize(page)
  await shot(page, 'home')
})

test('visual: NFT detail', async ({ page }) => {
  await openWithScenario(page, '/', 'instant')
  const [pick] = await pickEditions(page, 1)
  await page.goto(`/nft/${pick.nftId}?edition=${pick.editionId}`)
  await expect(main(page).getByRole('heading', { level: 1, name: pick.nftName })).toBeVisible()
  await expect(page.getByTestId('nft-card').first()).toBeVisible()
  await stabilize(page)
  await shot(page, 'detail')
})

test('visual: cart', async ({ page }) => {
  await openWithScenario(page, '/', 'instant')
  await login(page, USERS.ana, '/cart')
  const [first, second] = await pickEditions(page, 2)
  await addToCartViaApi(page, first, 2)
  await addToCartViaApi(page, second, 1)
  await page.goto('/cart')
  await expect(main(page).getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem')).toHaveCount(2)
  await expect(summaryTotal(page)).toBeVisible()
  await stabilize(page)
  await shot(page, 'cart')
})

test('visual: payment', async ({ page }) => {
  await openWithScenario(page, '/', 'instant')
  await login(page, USERS.ana, '/cart')
  const [first, second] = await pickEditions(page, 2)
  await addToCartViaApi(page, first, 2)
  await addToCartViaApi(page, second, 1)
  await page.goto('/checkout')
  await expect(main(page).getByRole('heading', { name: 'Pagamento' })).toBeVisible()
  await expect(summaryTotal(page)).toBeVisible()
  await expect(main(page).getByRole('radiogroup', { name: 'Carteira' })).toBeVisible()
  await stabilize(page)
  await shot(page, 'payment')
})
