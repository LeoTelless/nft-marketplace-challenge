import { expect, test, type Locator, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import { cards } from './support/catalog.ts'
import { addToCartViaApi, authDialog, fillCheckoutAndReview, login, main, pickEditions, reviewDialog, USERS } from './support/flows.ts'

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024

/** True when the focused element is inside `container`. */
const focusInside = (container: Locator) => container.evaluate((node) => node.contains(document.activeElement))

/** Presses Tab up to `max` times until `target` has focus. */
async function tabTo(page: Page, target: Locator, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab')
    if (await target.evaluate((node) => node === document.activeElement)) return
  }
  throw new Error(`Focus never reached the target after ${max} Tab presses`)
}

test.describe('keyboard navigation', () => {
  test('the skip link jumps to the main content', async ({ page }) => {
    await openWithScenario(page, '/')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeAttached()
    await expect(cards(page).first()).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(skip).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(main(page)).toBeFocused()
  })

  test('a card is reachable by Tab and opens the detail with Enter; the page keeps a visible focus ring', async ({ page }) => {
    await openWithScenario(page, '/')
    await expect(cards(page)).toHaveCount(9)
    const first = cards(page).first()
    const link = first.getByRole('link')
    const id = await first.getAttribute('data-nft-id')
    await tabTo(page, link)

    // Focus is visible: the card link draws an outline through its ::after.
    const outline = await link.evaluate((node) => getComputedStyle(node, '::after').outlineStyle)
    expect(outline).not.toBe('none')

    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`/nft/${id}`))
    await expect(main(page).getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('the favorite button is operable with the keyboard and announces its state', async ({ page }) => {
    await openWithScenario(page, '/')
    await login(page, USERS.ana, '/')
    await expect(cards(page)).toHaveCount(9)
    const heart = cards(page).nth(0).getByRole('button', { name: /^(Favoritar|Remover dos favoritos):/ })
    const pressed = (await heart.getAttribute('aria-pressed')) === 'true'
    await tabTo(page, heart)
    await page.keyboard.press('Space')
    await expect(heart).toHaveAttribute('aria-pressed', String(!pressed))
  })

  test('catalog filters and sorting work without a mouse', async ({ page }) => {
    test.skip(!isDesktop(page), 'The sidebar filters are desktop only; the mobile sheet is covered by its own test.')
    await openWithScenario(page, '/')
    await expect(cards(page)).toHaveCount(9)
    const sidebar = page.getByRole('complementary', { name: 'Filtros' })
    const art = sidebar.getByRole('checkbox', { name: /Arte digital/ })
    await tabTo(page, art)
    await page.keyboard.press('Space')
    await expect(page).toHaveURL(/category=art/)

    const sort = main(page).getByRole('combobox', { name: /Ordenar por/ })
    await sort.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('option', { name: 'Menor preço', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/sort=price_asc/)
    await expect(sort).toBeFocused()
  })

  test('the account menu opens with the keyboard and Escape returns focus to its button', async ({ page }) => {
    test.skip(!isDesktop(page) && (page.viewportSize()?.width ?? 0) < 768, 'Below 768 px the account lives in the "Conta" drawer (own test).')
    await openWithScenario(page, '/cart')
    await login(page, USERS.ana, '/cart')
    const trigger = page.getByTestId('user-menu')
    await trigger.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByRole('menuitem').first()).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(trigger).toBeFocused()
  })
})

test.describe('dialogs and sheets: focus is trapped and returned', () => {
  test('the login dialog keeps focus inside, closes with Escape and returns focus to where the user was', async ({ page }) => {
    // Start on the home page: the cart and checkout have no header/tab bar on mobile (as the frames).
    await openWithScenario(page, '/')
    await expect(main(page).getByRole('heading', { level: 1 }).first()).toBeAttached()
    // In-app navigation, opening the dialog from the page controls.
    if (isDesktop(page) || (page.viewportSize()?.width ?? 0) >= 768) {
      await page.getByTestId('header-login').first().focus()
      await page.keyboard.press('Enter')
    } else {
      await page.getByRole('button', { name: 'Conta', exact: true }).click()
      await page.getByRole('dialog', { name: 'Menu' }).getByTestId('header-login').click()
    }
    const dialog = authDialog(page)
    await expect(dialog).toBeVisible()
    await expect.poll(() => focusInside(dialog)).toBe(true)

    // Tab and Shift+Tab never leave the dialog.
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      expect(await focusInside(dialog)).toBe(true)
    }
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Shift+Tab')
      expect(await focusInside(dialog)).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL((url) => url.pathname === '/' && url.search === '')
    // Focus left the (removed) dialog: it is back in the page, not lost on <body> of an inert dialog.
    await expect.poll(() => page.evaluate(() => document.activeElement?.closest('[role="dialog"]') === null)).toBe(true)
  })

  test('the purchase review dialog traps focus and Escape closes it without buying', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await login(page, USERS.ana, '/cart')
    const [pick] = await pickEditions(page, 1)
    await addToCartViaApi(page, pick)
    await page.goto('/checkout')
    await fillCheckoutAndReview(page)

    const dialog = reviewDialog(page)
    await expect.poll(() => focusInside(dialog)).toBe(true)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      expect(await focusInside(dialog)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(0)
  })

  // DEFECT (src/features/checkout/components/checkout-page.tsx, review dialog): after closing the dialog with Escape the
  // focus ends on <body> instead of going back to the page's "Confirmar compra" button that opened it.
  test('closing the purchase review dialog returns focus to the button that opened it', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await login(page, USERS.ana, '/cart')
    const [pick] = await pickEditions(page, 1)
    await addToCartViaApi(page, pick)
    await page.goto('/checkout')
    await fillCheckoutAndReview(page)
    await page.keyboard.press('Escape')
    await expect(reviewDialog(page)).toBeHidden()
    await expect(main(page).getByRole('button', { name: 'Confirmar compra' })).toBeFocused()
  })

  test('the filters sheet (mobile) traps focus, closes with Escape and returns focus to its button', async ({ page }) => {
    test.skip(isDesktop(page), 'The filters sheet exists below 1024 px only.')
    await openWithScenario(page, '/')
    await expect(cards(page)).toHaveCount(9)
    const trigger = page.getByRole('button', { name: /^Filtros/ })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const sheet = page.getByRole('dialog', { name: 'Filtros' })
    await expect(sheet).toBeVisible()
    await expect.poll(() => focusInside(sheet)).toBe(true)
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab')
      expect(await focusInside(sheet)).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('the "Conta" drawer (mobile) is a labelled dialog that returns focus to the tab', async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, 'The drawer replaces the header below 768 px only.')
    await openWithScenario(page, '/')
    const tab = page.getByRole('button', { name: 'Conta', exact: true })
    await tab.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByRole('dialog', { name: 'Menu' })
    await expect(drawer).toBeVisible()
    await expect.poll(() => focusInside(drawer)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeHidden()
    await expect(tab).toBeFocused()
  })
})

test.describe('form validation moves focus to the first error', () => {
  test('checkout: invalid required fields are announced and the first one is focused', async ({ page }) => {
    await openWithScenario(page, '/', 'instant')
    await login(page, USERS.ana, '/cart')
    const [pick] = await pickEditions(page, 1)
    await addToCartViaApi(page, pick)
    await page.goto('/checkout')
    await expect(main(page).getByRole('heading', { name: 'Pagamento' })).toBeVisible()

    const username = main(page).getByLabel('Nome de usuário', { exact: true })
    await expect(username).toHaveValue('')
    await main(page).getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(username).toBeFocused()
    await expect(username).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await username.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    await expect(page.locator(`[id="${describedBy}"]`)).not.toBeEmpty()
    // The review dialog was not opened and nothing was bought.
    await expect(reviewDialog(page)).toHaveCount(0)
    expect(await page.evaluate(() => window.__mocks!.getState().orders.length)).toBe(0)

    // Fixing the field clears its error.
    await username.fill('ana.souza')
    await main(page).getByRole('button', { name: 'Confirmar compra' }).click()
    await expect(username).not.toHaveAttribute('aria-invalid', 'true')
  })

  test('the price filter errors are announced by an alert', async ({ page }) => {
    await openWithScenario(page, '/')
    await expect(cards(page)).toHaveCount(9)
    const open = isDesktop(page) ? null : page.getByRole('button', { name: /^Filtros/ })
    if (open) await open.click()
    const scope = isDesktop(page) ? page.getByRole('complementary', { name: 'Filtros' }) : page.getByRole('dialog', { name: 'Filtros' })
    await scope.getByLabel('Mínimo (ETH)').fill('9')
    await scope.getByLabel('Máximo (ETH)').fill('2')
    await scope.getByRole('button', { name: 'Aplicar' }).click()
    await expect(scope.getByRole('alert')).toHaveText('O preço mínimo deve ser menor ou igual ao máximo.')
    await expect(scope.getByLabel('Mínimo (ETH)')).toHaveAttribute('aria-invalid', 'true')
  })
})
