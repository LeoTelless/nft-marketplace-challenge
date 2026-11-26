import { expect, type Page } from '@playwright/test'

/** The app's main landmark (header/footer have their own links, buttons and inputs). */
export const main = (page: Page) => page.getByRole('main')

/**
 * Helpers for the purchase/session flows. Everything goes through the app's real paths:
 * the UI (by role/label), the simulated REST API (MSW) or `window.__mocks`. The app cache is
 * never touched directly.
 */
export const USERS = {
  ana: { id: 'user-ana', email: 'ana@nftmarket.test', password: 'Jungle@2026', name: 'Ana Souza' },
  bruno: { id: 'user-bruno', email: 'bruno@nftmarket.test', password: 'Market@2026', name: 'Bruno Lima' },
} as const

export async function fillLogin(page: Page, user: (typeof USERS)[keyof typeof USERS]) {
  await expect(main(page).getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await main(page).getByLabel('E-mail').fill(user.email)
  await main(page).getByLabel('Senha').fill(user.password)
  await main(page).getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Logs in from the login screen and waits until the app left it. */
export async function login(page: Page, user: (typeof USERS)[keyof typeof USERS], redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`)
  await fillLogin(page, user)
}

export interface EditionPick {
  nftId: string
  nftName: string
  editionId: string
  editionName: string
}

/** NFTs (deterministic fixtures) whose first edition has at least `minAvailable` units purchasable. */
export async function pickEditions(page: Page, count: number, minAvailable = 5): Promise<EditionPick[]> {
  return page.evaluate(
    ({ count, minAvailable }) => {
      const picks: EditionPick[] = []
      for (const nft of window.__mocks!.getState().nfts) {
        const edition = nft.editions[0]
        if (edition.available >= minAvailable && edition.maxPerOrder >= minAvailable) {
          picks.push({ nftId: nft.id, nftName: nft.name, editionId: edition.id, editionName: edition.name })
        }
        if (picks.length === count) break
      }
      return picks
    },
    { count, minAvailable },
  )
}

/**
 * Adds an item through the simulated REST API with the same credentials the app uses
 * (session token, or the visitor cart id). Stands in for the detail page's "add to cart",
 * which belongs to another screen.
 */
export async function addToCartViaApi(page: Page, pick: EditionPick, quantity = 1) {
  const status = await page.evaluate(
    async ({ pick, quantity }) => {
      const token = localStorage.getItem('nft.session.token')
      const guestCartId = localStorage.getItem('nft.cart.guestId')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      if (guestCartId) headers['X-Cart-Id'] = guestCartId
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers,
        body: JSON.stringify({ nftId: pick.nftId, editionId: pick.editionId, quantity }),
      })
      return response.status
    },
    { pick, quantity },
  )
  expect(status).toBe(200)
}

export function cartLine(page: Page, pick: EditionPick) {
  return main(page).getByRole('list', { name: 'Itens do carrinho' }).getByRole('listitem', { name: `${pick.nftName} (${pick.editionName})` })
}

export function lineQuantity(page: Page, pick: EditionPick) {
  return cartLine(page, pick).locator('output')
}

/** Fills the required collector fields, connects the primary wallet and opens the review. */
export async function fillCheckoutAndReview(page: Page, username = 'ana.souza') {
  await expect(main(page).getByRole('heading', { name: 'Pagamento' })).toBeVisible()
  await main(page).getByLabel('Nome de usuário').fill(username)
  // Totals must be loaded before reviewing.
  await expect(main(page).getByRole('region', { name: 'Resumo do pedido' }).getByTestId('summary-total')).toBeVisible()
  await main(page).getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(page.getByText(/Carteira .+ conectada\./)).toBeVisible()
  await main(page).getByRole('button', { name: 'Revisar pedido' }).click()
  await expect(main(page).getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
}
