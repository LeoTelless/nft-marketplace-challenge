import { expect, type Locator, type Page } from '@playwright/test'
import { main } from './flows.ts'

/** Catalog search field: the sidebar one on desktop, the compact bar on mobile (only one is rendered). */
export const searchBox = (page: Page) => page.getByRole('searchbox', { name: /Buscar NFTs/ })

export const cards = (page: Page) => page.getByTestId('nft-card')

/** `data-nft-id` of every card currently listed, in order. */
export const listedIds = (page: Page) => cards(page).evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-nft-id') ?? ''))

/** Names of the listed cards (the card heading link). */
export const listedNames = (page: Page) => cards(page).evaluateAll((nodes) => nodes.map((node) => node.querySelector('a')?.textContent ?? ''))

/** Displayed prices (ETH) of the listed cards. */
export const listedPrices = async (page: Page) =>
  (await page.getByTestId('nft-list').getByTestId('nft-price').allTextContents()).map((text) => Number.parseFloat(text.replace(',', '.')))

/** The sidebar and the toolbar sort are rendered from 1024 px (Tailwind `lg`); below it the sheet is used. */
const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024

/**
 * Runs `action` against the filters panel: the desktop sidebar (>= 1024 px) or, below it, the
 * "Filtros" bottom sheet, which is opened first and closed afterwards ("Ver N resultados").
 */
export async function withFilters(page: Page, action: (panel: Locator) => Promise<void>) {
  if (isDesktop(page)) {
    await action(page.getByRole('complementary', { name: 'Filtros' }))
    return
  }
  await page.getByRole('button', { name: /^Filtros/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Filtros' })
  await expect(sheet).toBeVisible()
  await action(sheet)
  await sheet.getByRole('button', { name: /^Ver( \d+)? resultados?$/ }).click()
  await expect(sheet).toBeHidden()
}

/** Chooses a sort option; the select lives in the page toolbar (desktop) or in the filters sheet (mobile). */
export async function chooseSort(page: Page, label: string) {
  if (isDesktop(page)) {
    await main(page).getByRole('combobox', { name: /Ordenar por/ }).click()
    await page.getByRole('option', { name: label, exact: true }).click()
    return
  }
  await withFilters(page, async (sheet) => {
    await sheet.getByRole('combobox', { name: /Ordenar por/ }).click()
    await page.getByRole('option', { name: label, exact: true }).click()
  })
}
