import { expect, type Page } from '@playwright/test'

/** The app's main landmark (header/footer have their own links, buttons and inputs). */
export const main = (page: Page) => page.getByRole('main')

/** Login/sign-up dialog and the purchase review dialog (rendered in a portal, outside `main`). */
export const authDialog = (page: Page, name: 'Entrar' | 'Criar conta' = 'Entrar') => page.getByRole('dialog', { name })
export const reviewDialog = (page: Page) => page.getByRole('dialog', { name: 'Revise seu pedido' })

/**
 * Helpers for the purchase/session flows. Everything goes through the app's real paths:
 * the UI (by role/label), the simulated REST API (MSW) or `window.__mocks`. The app cache is
 * never touched directly.
 */
export const USERS = {
  ana: { id: 'user-ana', email: 'ana@nftmarket.test', password: 'Jungle@2026', name: 'Ana Souza' },
  bruno: { id: 'user-bruno', email: 'bruno@nftmarket.test', password: 'Market@2026', name: 'Bruno Lima' },
} as const

export async function fillLogin(page: Page, user: { email: string; password: string }) {
  const dialog = authDialog(page)
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('E-mail', { exact: true }).fill(user.email)
  await dialog.getByLabel('Senha', { exact: true }).fill(user.password)
  await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
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
  /** Edition label shown in the UI (pt-BR). */
  editionName: string
}

const EDITION_PT: Record<string, string> = { Standard: 'Padrão', Rare: 'Rara', Legendary: 'Lendária' }

/** NFTs (deterministic fixtures) whose first edition has at least `minAvailable` units purchasable. */
export async function pickEditions(page: Page, count: number, minAvailable = 5): Promise<EditionPick[]> {
  const picks = await page.evaluate(
    ({ count, minAvailable }) => {
      const found: EditionPick[] = []
      for (const nft of window.__mocks!.getState().nfts) {
        const edition = nft.editions[0]
        if (edition.available >= minAvailable && edition.maxPerOrder >= minAvailable) {
          found.push({ nftId: nft.id, nftName: nft.name, editionId: edition.id, editionName: edition.name })
        }
        if (found.length === count) break
      }
      return found
    },
    { count, minAvailable },
  )
  return picks.map((pick) => ({ ...pick, editionName: EDITION_PT[pick.editionName] ?? pick.editionName }))
}

/**
 * Adds an item through the simulated REST API with the same credentials the app uses
 * (session token, or the visitor cart id). Used to set up carts quickly; the full purchase
 * spec adds through the detail page instead.
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

/** Adds one unit through the NFT detail page ("Adicionar ao carrinho"). */
export async function addToCartFromDetail(page: Page, pick: EditionPick) {
  await page.goto(`/nft/${pick.nftId}?edition=${pick.editionId}`)
  const button = main(page).getByRole('button', { name: 'Adicionar ao carrinho' })
  await expect(button).toBeEnabled()
  await button.click()
  await expect(page.getByText(`1 × ${pick.nftName} adicionado ao carrinho.`)).toBeVisible()
}

export function cartLine(page: Page, pick: EditionPick) {
  return main(page)
    .getByRole('list', { name: 'Itens do carrinho' })
    .getByRole('listitem', { name: `${pick.nftName} (${pick.editionName})` })
}

export function lineQuantity(page: Page, pick: EditionPick) {
  return cartLine(page, pick).locator('output')
}

export const summaryTotal = (page: Page) => main(page).getByRole('region', { name: 'Resumo do pedido' }).getByTestId('summary-total')

/** Fills the required collector fields, connects the primary wallet and opens the review dialog. */
export async function fillCheckoutAndReview(page: Page, username = 'ana.souza') {
  await expect(main(page).getByRole('heading', { name: 'Pagamento' })).toBeVisible()
  await main(page).getByLabel('Nome de usuário', { exact: true }).fill(username)
  // Totals must be loaded before reviewing.
  await expect(summaryTotal(page)).toBeVisible()
  await main(page).getByRole('button', { name: 'Conectar carteira' }).click()
  await expect(main(page).getByText(/Carteira .+ conectada\./)).toBeVisible()
  await main(page).getByRole('button', { name: 'Confirmar compra' }).click()
  await expect(reviewDialog(page).getByRole('button', { name: 'Confirmar compra' })).toBeEnabled()
}

/** The final "Confirmar compra" of the review dialog. */
export const confirmPurchase = (page: Page) => reviewDialog(page).getByRole('button', { name: /Confirmar compra|Tentar novamente/ })
