import { expect, test, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import { cards, chooseSort, listedIds, listedNames, listedPrices, searchBox, withFilters } from './support/catalog.ts'
import { main } from './support/flows.ts'

type Nft = ReturnType<NonNullable<Window['__mocks']>['getState']>['nfts'][number]

/** The simulated catalog (deterministic fixtures), read from the mock database. */
const catalog = (page: Page): Promise<Nft[]> => page.evaluate(() => window.__mocks!.getState().nfts)

const byNewest = (a: Nft, b: Nft) => b.createdAt.localeCompare(a.createdAt)
const PAGE_SIZE = 9

const ascending = (prices: number[]) => prices.length === PAGE_SIZE && prices.every((price, i) => i === 0 || prices[i - 1] <= price)
const descending = (prices: number[]) => prices.length === PAGE_SIZE && prices.every((price, i) => i === 0 || prices[i - 1] >= price)

test.describe('catalog: search, filters, sorting, pagination and history', () => {
  test('search narrows the list by name, creator or description, shows the empty state and clears', async ({ page }) => {
    await openWithScenario(page, '/')
    const nfts = await catalog(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    // A name fragment shared by a few NFTs: the expected hits come from the simulated database.
    const term = nfts[7].name.split(' ')[0].toLowerCase()
    const expected = nfts
      .filter((nft) => [nft.name, nft.creator.name, nft.description].some((text) => text.toLowerCase().includes(term)))
      .sort(byNewest)
    expect(expected.length).toBeGreaterThan(0)

    await searchBox(page).fill(term)
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(term)}`))
    await expect(cards(page)).toHaveCount(Math.min(expected.length, PAGE_SIZE))
    expect(await listedIds(page)).toEqual(expected.slice(0, PAGE_SIZE).map((nft) => nft.id))
    await expect(main(page).getByText(`${expected.length} ${expected.length === 1 ? 'NFT encontrado' : 'NFTs encontrados'}`)).toBeVisible()

    // No match: empty state with a way out.
    await searchBox(page).fill('zzzz-sem-resultado')
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Nenhum NFT encontrado' })).toBeVisible()
    await page.getByTestId('catalog-empty').getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(searchBox(page)).toHaveValue('')
    await expect(page).not.toHaveURL(/[?&]q=/)
  })

  test('combined filters (collections, price range, availability) agree with the catalog data', async ({ page }) => {
    await openWithScenario(page, '/')
    const nfts = await catalog(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    // Two collections, a price ceiling and only available items.
    const maxPrice = 3
    const expected = nfts
      .filter((nft) => ['art', 'gaming'].includes(nft.category) && Number(nft.minPrice) <= maxPrice && nft.totalAvailable > 0)
      .sort(byNewest)
    expect(expected.length).toBeGreaterThan(0)

    await withFilters(page, async (panel) => {
      await panel.getByRole('checkbox', { name: /Arte digital/ }).click()
      await panel.getByRole('checkbox', { name: /Jogos/ }).click()
      await panel.getByLabel('Máximo (ETH)').fill(String(maxPrice))
      await panel.getByRole('button', { name: 'Aplicar' }).click()
      await panel.getByText('Disponíveis', { exact: true }).click()
    })

    await expect(page).toHaveURL(/category=/)
    await expect(page).toHaveURL(/maxPrice=3/)
    await expect(page).toHaveURL(/availability=available/)
    await expect(cards(page)).toHaveCount(Math.min(expected.length, PAGE_SIZE))
    expect(await listedIds(page)).toEqual(expected.slice(0, PAGE_SIZE).map((nft) => nft.id))

    // Sold-out items are never listed with "Disponíveis", prices respect the ceiling.
    await expect(page.getByTestId('nft-availability')).toHaveCount(0)
    for (const price of await listedPrices(page)) expect(price).toBeLessThanOrEqual(maxPrice)

    // Clearing removes every filter.
    await main(page).getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await expect(page).not.toHaveURL(/category=|maxPrice=|availability=/)
  })

  test('the price range validates its fields before reaching the API', async ({ page }) => {
    await openWithScenario(page, '/')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    await withFilters(page, async (panel) => {
      await panel.getByLabel('Mínimo (ETH)').fill('5')
      await panel.getByLabel('Máximo (ETH)').fill('1')
      await panel.getByRole('button', { name: 'Aplicar' }).click()
      await expect(panel.getByRole('alert')).toHaveText('O preço mínimo deve ser menor ou igual ao máximo.')
      await panel.getByLabel('Mínimo (ETH)').fill('abc')
      await panel.getByRole('button', { name: 'Aplicar' }).click()
      await expect(panel.getByRole('alert')).toHaveText('Use números positivos, por exemplo 0,25.')
    })
    await expect(page).not.toHaveURL(/minPrice|maxPrice/)
  })

  test('sorting by price and by name reorders the list', async ({ page }) => {
    await openWithScenario(page, '/')
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    await chooseSort(page, 'Menor preço')
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect.poll(async () => ascending(await listedPrices(page))).toBe(true)
    const cheapest = Math.min(...(await catalog(page)).map((nft) => Number(nft.minPrice)))
    expect((await listedPrices(page))[0]).toBeCloseTo(cheapest, 6)

    await chooseSort(page, 'Maior preço')
    await expect.poll(async () => descending(await listedPrices(page))).toBe(true)

    await chooseSort(page, 'Nome: A → Z')
    await expect(page).toHaveURL(/sort=name_asc/)
    const expectedNames = (await catalog(page))
      .map((nft) => nft.name)
      .sort((a, b) => a.localeCompare(b))
      .slice(0, PAGE_SIZE)
    await expect.poll(() => listedNames(page)).toEqual(expectedNames)
  })

  test('pagination walks the 48 NFTs, resets on a new sort, and clamps a page out of range', async ({ page }) => {
    await openWithScenario(page, '/')
    const sorted = (await catalog(page)).sort(byNewest)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    expect(await listedIds(page)).toEqual(sorted.slice(0, PAGE_SIZE).map((nft) => nft.id))

    const pagination = page.getByRole('navigation', { name: 'Paginação do catálogo' })
    await pagination.getByRole('link', { name: 'Próxima página' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect(pagination.getByRole('link', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await expect.poll(() => listedIds(page)).toEqual(sorted.slice(PAGE_SIZE, 2 * PAGE_SIZE).map((nft) => nft.id))

    await pagination.getByRole('link', { name: 'Página 6' }).click()
    await expect(page).toHaveURL(/page=6/)
    await expect(cards(page)).toHaveCount(sorted.length - 5 * PAGE_SIZE)
    await expect(pagination.getByRole('link', { name: 'Próxima página' })).toHaveCount(0)

    // A new sort goes back to the first page.
    await chooseSort(page, 'Nome: Z → A')
    await expect(page).not.toHaveURL(/page=/)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)

    // Hand-edited URL beyond the last page lands on the last one.
    await page.goto('/?page=99')
    await expect(page).toHaveURL(/page=6/)
    await expect(cards(page)).toHaveCount(sorted.length - 5 * PAGE_SIZE)
  })

  test('back and forward restore search, filters, sort and page', async ({ page }) => {
    await openWithScenario(page, '/')
    const nfts = await catalog(page)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    const pagination = page.getByRole('navigation', { name: 'Paginação do catálogo' })

    // History: [/] → sort → page 2 → search.
    await chooseSort(page, 'Menor preço')
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect.poll(async () => ascending(await listedPrices(page))).toBe(true)
    const page1 = await listedIds(page)
    await pagination.getByRole('link', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await expect.poll(() => listedIds(page)).not.toEqual(page1)
    // The previous page stays on screen (dimmed) while the next one loads: wait for the refresh to finish.
    await expect(page.getByTestId('catalog-refreshing')).toHaveCount(0)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
    const page2 = await listedIds(page)
    const term = nfts[3].name.split(' ')[0].toLowerCase()
    await searchBox(page).fill(term)
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term)}`))
    await expect(page).not.toHaveURL(/page=2/)

    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await expect(page).not.toHaveURL(/[?&]q=/)
    await expect(searchBox(page)).toHaveValue('')
    await expect.poll(() => listedIds(page)).toEqual(page2)

    await page.goBack()
    await expect(page).not.toHaveURL(/page=/)
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect.poll(async () => ascending(await listedPrices(page))).toBe(true)

    await page.goForward()
    await page.goForward()
    await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(term)}`))
    await expect(searchBox(page)).toHaveValue(term)

    // A reload keeps the same view (the URL is the source of truth).
    const before = await listedIds(page)
    await page.reload()
    await expect(cards(page).first()).toBeVisible()
    await expect.poll(() => listedIds(page)).toEqual(before)
    await expect(searchBox(page)).toHaveValue(term)
  })

  test('opening a card and going back returns to the same filtered page', async ({ page }) => {
    await openWithScenario(page, '/?sort=price_desc&page=2')
    await expect(cards(page).first()).toBeVisible()
    const ids = await listedIds(page)
    const name = (await listedNames(page))[2]
    await cards(page).nth(2).getByRole('link', { name }).click()
    await expect(page).toHaveURL(new RegExp(`/nft/${ids[2]}`))
    await expect(main(page).getByRole('heading', { level: 1, name })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(/sort=price_desc/)
    await expect(page).toHaveURL(/page=2/)
    await expect.poll(() => listedIds(page)).toEqual(ids)
  })
})

test.describe('detail: direct access and missing resource', () => {
  test('direct link opens the NFT with the requested edition and refresh keeps it', async ({ page }) => {
    await openWithScenario(page, '/')
    const target = (await catalog(page)).find((nft) => nft.editions.length > 1 && nft.editions[1].available > 0)!
    const edition = target.editions[1]
    await page.goto(`/nft/${target.id}?edition=${edition.id}`)

    await expect(main(page).getByRole('heading', { level: 1, name: target.name })).toBeVisible()
    await expect(main(page).getByRole('radio', { checked: true })).toHaveAttribute('value', edition.id)
    await expect(main(page).getByRole('button', { name: 'Adicionar ao carrinho' })).toBeEnabled()

    await page.reload()
    await expect(main(page).getByRole('heading', { level: 1, name: target.name })).toBeVisible()
    await expect(main(page).getByRole('radio', { checked: true })).toHaveAttribute('value', edition.id)
  })

  test('an unknown edition in the link falls back to a valid one', async ({ page }) => {
    await openWithScenario(page, '/')
    const target = (await catalog(page))[0]
    await page.goto(`/nft/${target.id}?edition=nope`)
    await expect(main(page).getByRole('heading', { level: 1, name: target.name })).toBeVisible()
    await expect(main(page).getByRole('radio', { checked: true })).toHaveCount(1)
  })

  test('a nonexistent NFT shows its own not-found screen with a way back to the catalog', async ({ page }) => {
    const detailRequests: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/nfts/nft-does-not-exist') {
        detailRequests.push(request.url())
      }
    })
    await openWithScenario(page, '/nft/nft-does-not-exist')
    const notFound = page.getByTestId('nft-not-found')
    await expect(notFound).toBeVisible()
    // The 404 is requested once: neither a retry nor a second fetch when the route mounts.
    await page.waitForLoadState('networkidle')
    expect(detailRequests).toHaveLength(1)
    await expect(page.getByRole('heading', { name: 'Este NFT não existe ou foi removido' })).toBeVisible()
    await expect(notFound).toContainText('nft-does-not-exist')
    await expect(main(page).getByRole('button', { name: 'Adicionar ao carrinho' })).toHaveCount(0)

    await notFound.getByRole('link', { name: 'Explorar o catálogo' }).click()
    await expect(page).toHaveURL(/\/#catalogo$/)
    await expect(cards(page)).toHaveCount(PAGE_SIZE)
  })

  test('an unknown route shows the generic 404 page', async ({ page }) => {
    await openWithScenario(page, '/rota-que-nao-existe')
    await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible()
    await expect(main(page).getByRole('link').first()).toBeVisible()
  })
})
