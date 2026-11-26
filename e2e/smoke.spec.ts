import { expect, test } from '@playwright/test'
import { openWithScenario } from './support/mocks.ts'

/**
 * Smoke test of the foundation: REST (Axios → MSW Service Worker) and realtime
 * (socket.io-client → MSW WebSocket interception + @mswjs/socket.io-binding) end to end.
 */
test('lists NFTs over REST and applies nft.updated received by socket.io-client', async ({ page }) => {
  const catalogRequests: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/nfts') catalogRequests.push(request.url())
  })

  await openWithScenario(page, '/')

  const cards = page.getByTestId('nft-card')
  await expect(cards).toHaveCount(12)
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected')

  const first = cards.first()
  const nftId = await first.getAttribute('data-nft-id')
  expect(nftId).toBeTruthy()
  const requestsBeforeEvent = catalogRequests.length
  expect(requestsBeforeEvent).toBeGreaterThan(0)

  // Prices below every edition price, so they become the NFT's `minPrice` shown in the card.
  // 1. A backend change is pushed through the simulated Socket.IO server.
  await page.evaluate((id) => window.__mocks!.updateNft(id, { price: '0.0007' }), nftId!)
  await expect(first.getByTestId('nft-price')).toHaveText('0.0007 ETH')
  // The cache was patched by the socket listener, not by a REST refetch.
  expect(catalogRequests.length).toBe(requestsBeforeEvent)

  // 2. Duplicate (same eventId) and stale (older version) events must not regress the UI.
  await page.evaluate((id) => {
    window.__mocks!.replayLastEvent('nft.updated')
    window.__mocks!.emitStaleNftEvent(id)
  }, nftId!)
  // A later, valid event on another NFT proves the previous ones were already processed.
  const second = cards.nth(1)
  const secondId = await second.getAttribute('data-nft-id')
  await page.evaluate((id) => window.__mocks!.updateNft(id, { price: '0.0009' }), secondId!)
  await expect(second.getByTestId('nft-price')).toHaveText('0.0009 ETH')
  await expect(first.getByTestId('nft-price')).toHaveText('0.0007 ETH')

  // 3. While disconnected, changes are missed; on reconnection the client reconciles via REST.
  await page.evaluate(() => window.__mocks!.dropSocket())
  await expect(page.getByTestId('realtime-status')).not.toHaveAttribute('data-status', 'connected')
  await page.evaluate((id) => window.__mocks!.updateNft(id, { price: '0.0008' }), nftId!)
  await expect(first.getByTestId('nft-price')).toHaveText('0.0007 ETH')

  const requestsBeforeReconnect = catalogRequests.length
  await page.evaluate(() => window.__mocks!.restoreSocket())
  await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected', { timeout: 10_000 })
  await expect(first.getByTestId('nft-price')).toHaveText('0.0008 ETH')
  expect(catalogRequests.length).toBeGreaterThan(requestsBeforeReconnect)
})
