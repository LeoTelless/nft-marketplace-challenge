import { expect, test, type Page } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'
import { fillLogin, login, main, USERS } from './support/flows.ts'

const profileForm = (page: Page) => main(page).getByRole('form', { name: 'Perfil do colecionador' })
const NEW_PASSWORD = 'Novasenha@2026'

async function openProfile(page: Page, scenario = 'instant') {
  await openWithScenario(page, '/', scenario)
  await login(page, USERS.ana, '/account/profile')
  await expect(profileForm(page).getByLabel('E-mail', { exact: true })).toHaveValue(USERS.ana.email)
  return profileForm(page)
}

async function fillPasswords(form: ReturnType<typeof profileForm>, values: { current: string; next: string; confirm: string }) {
  await form.getByLabel('Senha atual', { exact: true }).fill(values.current)
  await form.getByLabel('Nova senha', { exact: true }).fill(values.next)
  await form.getByLabel('Confirmar nova senha', { exact: true }).fill(values.confirm)
}

test.describe('profile: password', () => {
  test('client validation reports each rule and focuses the first invalid field', async ({ page }) => {
    const form = await openProfile(page)

    await form.getByLabel('Senha atual', { exact: true }).fill(USERS.ana.password)
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByLabel('Nova senha', { exact: true })).toBeFocused()
    await expect(form.getByLabel('Nova senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')

    await fillPasswords(form, { current: USERS.ana.password, next: USERS.ana.password, confirm: USERS.ana.password })
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('A nova senha deve ser diferente da atual')).toBeVisible()

    await fillPasswords(form, { current: USERS.ana.password, next: NEW_PASSWORD, confirm: 'Diferente@2026' })
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('As senhas não coincidem')).toBeVisible()
    await expect(form.getByLabel('Confirmar nova senha', { exact: true })).toBeFocused()

    await fillPasswords(form, { current: '', next: NEW_PASSWORD, confirm: NEW_PASSWORD })
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Informe a senha atual')).toBeVisible()
    await expect(form.getByLabel('Senha atual', { exact: true })).toBeFocused()
  })

  test('a wrong current password is reported by the API on its field', async ({ page }) => {
    const form = await openProfile(page)
    await fillPasswords(form, { current: 'Errada@2026', next: NEW_PASSWORD, confirm: NEW_PASSWORD })
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('A senha atual está incorreta')).toBeVisible()
    await expect(form.getByLabel('Senha atual', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('Senha alterada.')).toHaveCount(0)
  })

  test('a server-side rule on the new password is shown on the field (validation-error scenario)', async ({ page }) => {
    const form = await openProfile(page, 'validation-error')
    await fillPasswords(form, { current: USERS.ana.password, next: NEW_PASSWORD, confirm: NEW_PASSWORD })
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Esta senha foi usada recentemente (regra simulada do servidor)')).toBeVisible()
    await expect(form.getByLabel('Nova senha', { exact: true })).toHaveAttribute('aria-invalid', 'true')
  })

  test('changing the password works: the new one logs in, the old one no longer does', async ({ page }) => {
    const form = await openProfile(page)
    await fillPasswords(form, { current: USERS.ana.password, next: NEW_PASSWORD, confirm: NEW_PASSWORD })
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Senha alterada.')).toBeVisible()
    await expect(form.getByLabel('Senha atual', { exact: true })).toHaveValue('')

    await main(page).getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/$/)

    await page.goto('/login')
    const dialog = page.getByRole('dialog', { name: 'Entrar' })
    await dialog.getByLabel('E-mail', { exact: true }).fill(USERS.ana.email)
    await dialog.getByLabel('Senha', { exact: true }).fill(USERS.ana.password)
    await dialog.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')

    await fillLogin(page, { ...USERS.ana, password: NEW_PASSWORD })
    await expect(page).toHaveURL(/\/$/)
  })
})

test.describe('profile: data and avatar', () => {
  test('required fields and formats are validated before saving', async ({ page }) => {
    const form = await openProfile(page)
    await form.getByLabel('Nome de exibição').fill('')
    await form.getByLabel('E-mail', { exact: true }).fill('nao-e-um-email')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByLabel('Nome de exibição')).toBeFocused()
    await expect(form.getByLabel('Nome de exibição')).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByLabel('E-mail', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    // Nothing reached the (simulated) server.
    const saved = await page.evaluate(() => window.__mocks!.getState().users.find((user) => user.id === 'user-ana')!.name)
    expect(saved).toBe(USERS.ana.name)
  })

  test('a server validation error lands on the field and the form recovers once fixed', async ({ page }) => {
    const form = await openProfile(page, 'validation-error')
    await form.getByLabel('Nome de exibição').fill('Ana Nova')
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(form.getByText('Este nome não é permitido (regra simulada do servidor)')).toBeVisible()
    await expect(form.getByLabel('Nome de exibição')).toHaveAttribute('aria-invalid', 'true')

    await page.evaluate(() => window.__mocks!.setScenario('instant'))
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText('Perfil atualizado.')).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.__mocks!.getState().users.find((user) => user.id === 'user-ana')!.name)).toBe('Ana Nova')
  })

  test('avatar: preview before sending, sent to the API, then removed', async ({ page }) => {
    await openProfile(page)
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    )
    const chooser = page.waitForEvent('filechooser')
    await main(page).getByRole('button', { name: 'Alterar avatar' }).click()
    await (await chooser).setFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
    await expect(main(page).getByRole('img', { name: 'Pré-visualização do novo avatar' })).toBeVisible()

    // Too large: rejected on the client, before any request.
    const big = page.waitForEvent('filechooser')
    await main(page).getByRole('button', { name: 'Cancelar' }).click()
    await main(page).getByRole('button', { name: 'Alterar avatar' }).click()
    await (await big).setFiles({ name: 'big.png', mimeType: 'image/png', buffer: Buffer.alloc(1_100_000) })
    await expect(main(page).getByText('A imagem deve ter no máximo 1 MB.')).toBeVisible()

    const again = page.waitForEvent('filechooser')
    await main(page).getByRole('button', { name: 'Alterar avatar' }).click()
    await (await again).setFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
    await main(page).getByRole('button', { name: 'Enviar avatar' }).click()
    await expect(main(page).getByRole('img', { name: `Avatar de ${USERS.ana.name}` })).toBeVisible()
    await page.reload()
    await expect(main(page).getByRole('img', { name: `Avatar de ${USERS.ana.name}` })).toBeVisible()

    await main(page).getByRole('button', { name: 'Remover avatar' }).click()
    await expect(main(page).getByRole('img', { name: `Avatar de ${USERS.ana.name}` })).toHaveCount(0)
    await expect(main(page).getByRole('button', { name: 'Remover avatar' })).toHaveCount(0)
  })
})

test.describe('wallets', () => {
  const NEW_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F'
  const secondaryForm = (page: Page) => main(page).getByRole('form', { name: 'Adicionar carteira secundária' })

  async function openWalletsAsBruno(page: Page, scenario = 'instant') {
    await openWithScenario(page, '/', scenario)
    await login(page, USERS.bruno, '/account/wallets')
    await expect(main(page).getByLabel('Apelido da carteira')).toHaveValue('Coinbase Wallet')
    await main(page).getByRole('button', { name: 'Adicionar carteira secundária' }).click()
    const form = secondaryForm(page)
    await expect(form).toBeVisible()
    return form
  }

  test('adds a secondary wallet after validating label, address and networks', async ({ page }) => {
    const form = await openWalletsAsBruno(page)

    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByLabel('Apelido da carteira')).toBeFocused()
    await expect(form.getByLabel('Apelido da carteira')).toHaveAttribute('aria-invalid', 'true')

    await form.getByLabel('Apelido da carteira').fill('Cofre')
    await form.getByLabel('Endereço da carteira').fill('0x123')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText(/Endereço de carteira inválido/)).toBeVisible()
    await expect(form.getByLabel('Endereço da carteira')).toBeFocused()

    // The (default) network is required: unchecking it is reported.
    await form.getByLabel('Endereço da carteira').fill(NEW_ADDRESS)
    await form.getByText('Ethereum', { exact: true }).click()
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    // The error is linked to the group (aria-describedby) and nothing is created.
    await expect(form.getByRole('group', { name: 'Redes' })).toHaveAttribute('aria-describedby', /error/)
    await form.getByText('Ethereum', { exact: true }).click()

    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira Cofre adicionada.')).toBeVisible()
    const wallets = await page.evaluate(() => window.__mocks!.getState().wallets.filter((wallet) => wallet.userId === 'user-bruno'))
    expect(wallets.map((wallet) => [wallet.label, wallet.role])).toEqual([
      ['Coinbase Wallet', 'primary'],
      ['Cofre', 'secondary'],
    ])

    await page.reload()
    await expect(main(page).getByLabel('Apelido da carteira')).toHaveCount(2)
  })

  // DEFECT (src/features/wallets/components/wallets-page.tsx): with every network unchecked the field shows the raw Zod
  // message "Demasiado pequeno: esperava que o vetor tivesse >= 1 elementos" instead of the intended
  // "Selecione ao menos uma rede" (the fallback is never used because `errors.networks.message` is set).
  test.fixme('unchecking every network shows the friendly message', async ({ page }) => {
    const form = await openWalletsAsBruno(page)
    await form.getByText('Ethereum', { exact: true }).click()
    await form.getByLabel('Apelido da carteira').fill('Cofre')
    await form.getByLabel('Endereço da carteira').fill(NEW_ADDRESS)
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Selecione ao menos uma rede')).toBeVisible()
  })

  test('an address already registered is rejected by the API on the field', async ({ page }) => {
    const form = await openWalletsAsBruno(page)
    await form.getByLabel('Apelido da carteira').fill('Duplicada')
    await form.getByLabel('Endereço da carteira').fill('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2')
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Este endereço já está cadastrado')).toBeVisible()
    await expect(form.getByLabel('Endereço da carteira')).toHaveAttribute('aria-invalid', 'true')
    expect(await page.evaluate(() => window.__mocks!.getState().wallets.filter((wallet) => wallet.userId === 'user-bruno').length)).toBe(1)

    // Fixing the address recovers the same form.
    await form.getByLabel('Endereço da carteira').fill(NEW_ADDRESS)
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira Duplicada adicionada.')).toBeVisible()
  })

  test('a server rule (validation-error scenario) is reported on the address', async ({ page }) => {
    const form = await openWalletsAsBruno(page, 'validation-error')
    await form.getByLabel('Apelido da carteira').fill('Sinalizada')
    await form.getByLabel('Endereço da carteira').fill(NEW_ADDRESS)
    await form.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(form.getByText('Este endereço foi sinalizado (regra simulada do servidor)')).toBeVisible()
    expect(await page.evaluate(() => window.__mocks!.getState().wallets.filter((wallet) => wallet.userId === 'user-bruno').length)).toBe(1)
  })

  test('edits the nickname and promotes the secondary wallet to primary', async ({ page }) => {
    await openWithScenario(page, '/')
    await login(page, USERS.ana, '/account/wallets')
    const primary = main(page).getByRole('form', { name: 'Editar carteira principal' })
    await expect(primary.getByLabel('Apelido da carteira')).toHaveValue('Main MetaMask')

    await primary.getByLabel('Apelido da carteira').fill('Carteira diária')
    await primary.getByRole('button', { name: 'Salvar carteira' }).click()
    await expect(page.getByText('Carteira Carteira diária atualizada.')).toBeVisible()
    await page.reload()
    await expect(main(page).getByRole('form', { name: 'Editar carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Carteira diária')

    await main(page).getByRole('button', { name: /Tornar principal/ }).click()
    await expect(page.getByText('Backup WalletConnect agora é a carteira principal.')).toBeVisible()
    await expect(main(page).getByRole('form', { name: 'Editar carteira principal' }).getByLabel('Apelido da carteira')).toHaveValue('Backup WalletConnect')
    const roles = await page.evaluate(() =>
      Object.fromEntries(window.__mocks!.getState().wallets.filter((wallet) => wallet.userId === 'user-ana').map((wallet) => [wallet.label, wallet.role])),
    )
    expect(roles).toEqual({ 'Backup WalletConnect': 'primary', 'Carteira diária': 'secondary' })
  })
})
