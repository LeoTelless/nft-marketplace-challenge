import type { Page } from '@playwright/test'

/**
 * Typed access to `window.__mocks` (see `src/mocks/control.ts`). Every call changes the
 * simulated backend or emits through the simulated Socket.IO server; tests never touch the
 * app cache or UI directly.
 */
export interface MocksControl {
  getScenario(): string
  setScenario(id: string): void
  reset(): void
  updateNft(nftId: string, patch: { editionId?: string; price?: string; available?: number }): unknown
  resolveOrder(orderId: string, outcome: 'confirmed' | 'rejected'): unknown
  expireSessions(): void
  replayLastEvent(type?: 'nft.updated' | 'order.updated'): unknown
  emitStaleNftEvent(nftId: string): unknown
  dropSocket(): void
  restoreSocket(): void
  connectedSockets(): Array<{ userId: string | null }>
}

declare global {
  interface Window {
    __mocks?: MocksControl
  }
}

/** Opens a page with a fresh seed database and the given scenario. */
export async function openWithScenario(page: Page, path: string, scenario = 'instant') {
  const separator = path.includes('?') ? '&' : '?'
  await page.goto(`${path}${separator}mocks=reset&scenario=${scenario}`)
  await page.waitForFunction(() => window.__mocks !== undefined)
}

