import { expect, test, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import { cards, listedNames } from './support/catalog.ts'
import { authDialog, login, main, USERS } from './support/flows.ts'

const NEW_USER = { name: 'Carla Dias', email: 'carla@nftmarket.test', password: 'Colecao@2026' }

async function fillRegister(page: Page, values: { name: string; email: string; password: string; confirm?: string }) {
  const dialog = authDialog(page, 'Criar conta')
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Nome de usuário', { exact: true }).fill(values.name)
  await dialog.getByLabel('E-mail', { exact: true }).fill(values.email)
  await dialog.getByLabel('Senha', { exact: true }).fill(values.password)
  await dialog.getByLabel('Confirmar senha', { exact: true }).fill(values.confirm ?? values.password)
  await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
  return dialog
}

test.describe('sign-up', () => {
  test('creates the account, starts a session and lands on the home page', async ({ page }) => {
    await openWithScenario(page, '/register')
    await fillRegister(page, NEW_USER)

    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText(`Conta criada. Boas-vindas, ${NEW_USER.name}!`)).toBeVisible()
    await expect(cards(page).first()).toBeVisible()
    const users = await page.evaluate(() => window.__mocks!.getState().users.map((user) => user.email))
    expect(users).toContain(NEW_USER.email)

    // The session is real: a private page opens without asking to log in.
    await page.goto('/account/profile')
    await expect(main(page).getByLabel('E-mail', { exact: true })).toHaveValue(NEW_USER.email)
  })

  test('validates the fields on the client and focuses the first invalid one', async ({ page }) => {
    await openWithScenario(page, '/register')
    const dialog = authDialog(page, 'Criar conta')
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(dialog.getByLabel('Nome de usuário', { exact: true })).toBeFocused()
    await expect(dialog.getByLabel('Nome de usuário', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await fillRegister(page, { name: NEW_USER.name, email: NEW_USER.email, password: 'curta', confirm: 'curta' })
    await expect(dialog.getByLabel('Senha', { exact: true })).toBeFocused()
    await expect(dialog.getByLabel('Senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await dialog.getByLabel('Senha', { exact: true }).fill(NEW_USER.password)
    await dialog.getByLabel('Confirmar senha', { exact: true }).fill('Outra@2026')
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(dialog.getByText('As senhas não coincidem')).toBeVisible()
    await expect(dialog.getByLabel('Confirmar senha', { exact: true })).toBeFocused()
    expect(await page.evaluate(() => window.__mocks!.getState().users.length)).toBe(2)
  })

  test('an e-mail already registered is reported on the field and creates nothing', async ({ page }) => {
    await openWithScenario(page, '/register')
    const dialog = await fillRegister(page, { name: 'Ana Clone', email: USERS.ana.email, password: NEW_USER.password })

    await expect(dialog.getByText('Este e-mail já está cadastrado')).toBeVisible()
    await expect(dialog.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(dialog.getByLabel('E-mail', { exact: true })).toBeFocused()
    await expect(page).toHaveURL(/\/register/)
    expect(await page.evaluate(() => window.__mocks!.getState().users.length)).toBe(2)

    // Correcting the e-mail recovers the same form.
    await dialog.getByLabel('E-mail', { exact: true }).fill(NEW_USER.email)
    await dialog.getByRole('button', { name: 'Criar conta', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    expect(await page.evaluate(() => window.__mocks!.getState().users.length)).toBe(3)
  })

  test('the register-conflict scenario rejects even a new e-mail', async ({ page }) => {
    await openWithScenario(page, '/register', 'register-conflict')
    const dialog = await fillRegister(page, NEW_USER)
    await expect(dialog.getByText('Este e-mail já está cadastrado')).toBeVisible()
    expect(await page.evaluate(() => window.__mocks!.getState().users.length)).toBe(2)
  })
})

test.describe('login, private pages and logout', () => {
  test('a private page sends visitors to login and returns to it afterwards', async ({ page }) => {
    await openWithScenario(page, '/account/wallets')
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fwallets/)
    await expect(authDialog(page)).toBeVisible()

    const dialog = authDialog(page)
    await dialog.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/account\/wallets$/)
    await expect(main(page).getByLabel('Apelido da carteira').first()).toHaveValue('Main MetaMask')
  })

  test('an expired session found on a private request asks for a new login and keeps the destination', async ({ page }) => {
    await openWithScenario(page, '/')
    await login(page, USERS.ana, '/account/profile')
    await expect(main(page).getByLabel('E-mail', { exact: true })).toHaveValue(USERS.ana.email)

    // One-shot: the next authenticated request answers 401 `session_expired`.
    await page.evaluate(() => window.__mocks!.setScenario('session-expired'))
    await page.goto('/account/wallets')
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Fwallets&reason=expired/)
    await expect(authDialog(page).getByText('Sua sessão expirou. Entre novamente para continuar de onde parou.')).toBeVisible()
    await expect(authDialog(page).getByRole('alert')).toHaveCount(0)

    const dialog = authDialog(page)
    await dialog.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/account\/wallets$/)
  })

  test('logout ends the session on the server, leaves private pages and blocks them again', async ({ page }) => {
    await openWithScenario(page, '/')
    await login(page, USERS.ana, '/account/favorites')
    await expect(main(page).getByRole('list', { name: 'NFTs favoritos' })).toBeVisible()

    await main(page).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('Você saiu da sua conta.')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__mocks!.connectedSockets().map((socket) => socket.userId))).not.toContain(USERS.ana.id)

    // The private page is closed again, and the favorites of the account are not visible to the visitor.
    await page.goto('/account/favorites')
    await expect(page).toHaveURL(/\/login\?redirect=%2Faccount%2Ffavorites/)
    await expect(authDialog(page)).toBeVisible()
  })
})

test.describe('favorites', () => {
  const heart = (page: Page, name: string, pressed: boolean) =>
    cards(page).getByRole('button', { name: `${pressed ? 'Remover dos favoritos' : 'Favoritar'}: ${name}` })

  test('a visitor is sent to login and comes back to favorite the NFT', async ({ page }) => {
    await openWithScenario(page, '/')
    await expect(cards(page)).toHaveCount(9)
    const [name] = await listedNames(page)
    await heart(page, name, false).click()
    await expect(page).toHaveURL(/\/login\?redirect=/)
    await expect(authDialog(page).getByText('Entre na sua conta para continuar.')).toBeVisible()

    const dialog = authDialog(page)
    await dialog.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(cards(page)).toHaveCount(9)
  })

  test('favoriting and unfavoriting persists in the simulated backend and after refresh', async ({ page }) => {
    await openWithScenario(page, '/')
    await login(page, USERS.ana, '/')
    await expect(cards(page)).toHaveCount(9)
    const stateIds = () => page.evaluate((id) => window.__mocks!.getState().favorites[id] ?? [], USERS.ana.id)
    const before = await stateIds()
    const names = await listedNames(page)
    const name = names[0]
    const id = await cards(page).first().getAttribute('data-nft-id')
    const wasFavorite = before.includes(id!)

    await heart(page, name, wasFavorite).click()
    await expect(heart(page, name, !wasFavorite)).toHaveAttribute('aria-pressed', String(!wasFavorite))
    await expect.poll(async () => (await stateIds()).includes(id!)).toBe(!wasFavorite)

    await page.reload()
    await expect(heart(page, name, !wasFavorite)).toBeVisible()

    await heart(page, name, !wasFavorite).click()
    await expect(heart(page, name, wasFavorite)).toBeVisible()
    await expect.poll(async () => (await stateIds()).includes(id!)).toBe(wasFavorite)
  })

  test('a failed mutation reverts the heart with a notice, and a new attempt succeeds', async ({ page }) => {
    await openWithScenario(page, '/')
    await login(page, USERS.ana, '/')
    await expect(cards(page)).toHaveCount(9)
    const stateIds = () => page.evaluate((id) => window.__mocks!.getState().favorites[id] ?? [], USERS.ana.id)
    const before = await stateIds()
    // A card that is not a favorite yet.
    const candidates = await cards(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-nft-id') ?? ''))
    const targetIndex = candidates.findIndex((id) => !before.includes(id))
    expect(targetIndex).toBeGreaterThanOrEqual(0)
    const name = (await listedNames(page))[targetIndex]
    const id = candidates[targetIndex]

    await page.evaluate(() => window.__mocks!.setScenario('server-error'))
    await heart(page, name, false).click()
    await expect(page.getByText('Não foi possível favoritar.')).toBeVisible()
    // Rolled back: not pressed, server unchanged.
    await expect(heart(page, name, false)).toHaveAttribute('aria-pressed', 'false')
    expect(await stateIds()).toEqual(before)

    // Recovery: the service is back, the same action works and the state matches the server.
    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await heart(page, name, false).click()
    await expect(heart(page, name, true)).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await stateIds()).includes(id)).toBe(true)
    await page.reload()
    await expect(heart(page, name, true)).toBeVisible()
  })
})
