import { expect, test, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import { cards, chooseSort, listedPrices } from './support/catalog.ts'
import { addToCartViaApi, login, main, pickEditions, USERS } from './support/flows.ts'

/**
 * Loading, failure and recovery states. Latency comes from the MSW scenarios (`slow`,
 * `variable-latency`, ...) and time is driven with `page.clock`, so nothing here sleeps: the
 * skeleton is observed while the simulated request is pending, then the clock moves past it.
 */

/** Installs the fake clock before the first navigation (timers still run, `runFor` jumps ahead). */
async function withClock(page: Page) {
  await page.clock.install()
}

const skeleton = (page: Page, name: string) => page.getByLabel(name)

test.describe('skeletons while loading slowly', () => {
  test('the catalog shows its skeleton grid, then the cards, without a layout jump', async ({ page }) => {
    await withClock(page)
    await openWithScenario(page, '/', 'slow')
    const loading = skeleton(page, 'Carregando NFTs')
    await expect(loading).toBeVisible()
    await expect(loading).toHaveAttribute('aria-busy', 'true')
    await expect(cards(page)).toHaveCount(0)
    const pending = await loading.boundingBox()

    await page.clock.runFor(3_000)
    await expect(cards(page)).toHaveCount(9)
    await expect(loading).toHaveCount(0)
    // The grid occupies the same top position before and after (no layout shift of the section).
    const loaded = await page.getByTestId('nft-list').boundingBox()
    expect(Math.abs(loaded!.y - pending!.y)).toBeLessThanOrEqual(2)
  })

  test('the NFT detail shows the page skeleton and then the content', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    const [pick] = await pickEditions(page, 1)
    await withClock(page)
    await page.evaluate(() => window.__mocks!.setScenario('slow'))
    await page.goto(`/nft/${pick.nftId}`)
    await expect(page.getByTestId('nft-detail-skeleton')).toBeVisible()
    await expect(main(page).getByRole('heading', { level: 1 })).toHaveCount(0)

    await page.clock.runFor(3_000)
    await expect(main(page).getByRole('heading', { level: 1, name: pick.nftName })).toBeVisible()
    await expect(page.getByTestId('nft-detail-skeleton')).toHaveCount(0)
  })

  test('private pages (cart, profile, wallets) show skeletons while their data loads', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await login(page, USERS.ana, '/account/favorites')
    const [pick] = await pickEditions(page, 1)
    await addToCartViaApi(page, pick)
    await expect(main(page).getByRole('list', { name: 'NFTs favoritos' })).toBeVisible()
    await withClock(page)
    await page.evaluate(() => window.__mocks!.setScenario('slow'))

    // In-app navigation (no reload) so the session stays; each page starts from an empty cache.
    await main(page).getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Dados do perfil' }).click()
    await expect(skeleton(page, 'Carregando perfil')).toBeVisible()
    await page.clock.runFor(3_000)
    await expect(main(page).getByRole('form', { name: 'Perfil do colecionador' })).toBeVisible()

    await page.evaluate(() => window.__mocks!.setScenario('slow'))
    await main(page).getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Carteiras', exact: true }).click()
    await page.clock.runFor(100)
    await page.clock.runFor(3_000)
    await expect(main(page).getByRole('form', { name: 'Editar carteira principal' })).toBeVisible()
  })

  test('with variable latency the page still settles on the latest search (out-of-order responses are ignored)', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await expect(cards(page)).toHaveCount(9)
    await withClock(page)
    const order: string[] = []
    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.pathname === '/api/nfts' && url.searchParams.get('pageSize') === '9') order.push(url.searchParams.get('sort') ?? '')
    })

    // `out-of-order`: list requests alternate 1.6 s and 0.15 s, so a later request can answer first.
    await page.evaluate(() => window.__mocks!.setScenario('out-of-order'))
    await chooseSort(page, 'Menor preço')
    await chooseSort(page, 'Maior preço')
    await page.clock.runFor(4_000)

    await expect(page).toHaveURL(/sort=price_desc/)
    await expect.poll(async () => {
      const prices = await listedPrices(page)
      return prices.length === 9 && prices.every((price, i) => i === 0 || prices[i - 1] >= price)
    }).toBe(true)
    // The list reflects the last request, whatever the order in which the answers arrive.
    expect(order.slice(-2)).toEqual(['price_asc', 'price_desc'])
  })
})

test.describe('failure feedback and recovery', () => {
  test('catalog: HTTP 500 shows the error with "Tentar novamente"; it recovers once the service is back', async ({ page }) => {
    await withClock(page)
    await openWithScenario(page, '/', 'server-error')
    // Transient errors are retried by the client (with back-off) before the error is shown.
    await expect(skeleton(page, 'Carregando NFTs')).toBeVisible()
    await page.clock.runFor(6_000)
    const error = page.getByTestId('catalog-error')
    await expect(error).toBeVisible()
    await expect(error.getByRole('heading', { name: 'Não foi possível carregar o catálogo' })).toBeVisible()
    await expect(cards(page)).toHaveCount(0)

    // Retrying while the failure persists keeps the error (and does not break the page).
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await page.clock.runFor(6_000)
    await expect(error).toBeVisible()

    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page)).toHaveCount(9)
    await expect(error).toHaveCount(0)
  })

  test('catalog: no connection is reported as such and recovers', async ({ page }) => {
    await withClock(page)
    await openWithScenario(page, '/', 'offline')
    await page.clock.runFor(6_000)
    const error = page.getByTestId('catalog-error')
    await expect(error).toContainText('Sem conexão com o servidor.')

    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('catalog: transient 503s are absorbed by the automatic retries ("flaky")', async ({ page }) => {
    await withClock(page)
    await openWithScenario(page, '/', 'flaky')
    await expect(skeleton(page, 'Carregando NFTs')).toBeVisible()
    await page.clock.runFor(6_000)
    await expect(cards(page)).toHaveCount(9)
    await expect(page.getByTestId('catalog-error')).toHaveCount(0)
  })

  test('catalog: an empty result is not an error', async ({ page }) => {
    await openWithScenario(page, '/', 'empty')
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
    await expect(page.getByText('O catálogo está vazio no momento.')).toBeVisible()
    await expect(page.getByTestId('catalog-error')).toHaveCount(0)
  })

  test('catalog: a stalled request ends in a timeout message and can be retried', async ({ page }) => {
    await withClock(page)
    await openWithScenario(page, '/', 'request-timeout')
    await expect(skeleton(page, 'Carregando NFTs')).toBeVisible()
    // The client gives up after 15 s (x3 attempts); the simulated server would answer after 20 s.
    await page.clock.runFor(60_000)
    const error = page.getByTestId('catalog-error')
    await expect(error).toContainText('O servidor demorou para responder.')

    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(cards(page)).toHaveCount(9)
  })

  test('detail: a failure shows its own error and "Tentar novamente" loads the NFT', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    const [pick] = await pickEditions(page, 1)
    await withClock(page)
    await page.evaluate(() => window.__mocks!.setScenario('server-error'))
    await page.goto(`/nft/${pick.nftId}`)
    await page.clock.runFor(6_000)
    const error = page.getByTestId('nft-detail-error')
    await expect(error).toBeVisible()
    await expect(error.getByRole('heading', { name: 'Não foi possível carregar este NFT' })).toBeVisible()
    await expect(error.getByRole('link', { name: 'Voltar ao catálogo' })).toBeVisible()

    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(main(page).getByRole('heading', { level: 1, name: pick.nftName })).toBeVisible()
  })

  test('profile: a failure shows the error and "Tentar novamente" brings the form back', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await login(page, USERS.ana, '/account/favorites')
    await expect(main(page).getByRole('list', { name: 'NFTs favoritos' })).toBeVisible()
    await withClock(page)
    await page.evaluate(() => window.__mocks!.setScenario('server-error'))
    await main(page).getByRole('navigation', { name: 'Meu perfil' }).getByRole('link', { name: 'Dados do perfil' }).click()
    await page.clock.runFor(6_000)
    await expect(main(page).getByRole('heading', { name: 'Não foi possível carregar o perfil' })).toBeVisible()

    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await main(page).getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(main(page).getByRole('form', { name: 'Perfil do colecionador' })).toBeVisible()
  })

  test('cart: a failed quantity change is reverted with feedback and works again afterwards', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await login(page, USERS.ana, '/cart')
    const [pick] = await pickEditions(page, 1)
    await addToCartViaApi(page, pick)
    await page.goto('/cart')
    const line = main(page).getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem', { name: `${pick.nftName} (${pick.editionName})` })
    await expect(line.locator('output')).toHaveText('1')

    await page.evaluate(() => window.__mocks!.setScenario('server-error'))
    await line.getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(page.getByText(/Não foi possível/).first()).toBeVisible()
    await expect(line.locator('output')).toHaveText('1')
    expect(await page.evaluate(() => window.__mocks!.getState().carts.flatMap((cart) => cart.lines.map((l) => l.quantity)))).toEqual([1])

    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await line.getByRole('button', { name: /Aumentar quantidade/ }).click()
    await expect(line.locator('output')).toHaveText('2')
  })
})
