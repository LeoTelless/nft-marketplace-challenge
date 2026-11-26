import type { Nft, Order, RealtimeEvent } from '@/contracts'
import { clearOrderTimers, resolveOrder as resolveDbOrder } from './db/commerce'
import { db, findNft, mutateNft, persist, resetDb } from './db/store'
import type { DbState } from './db/types'
import { connectedPeers, dropSockets, emitStaleNftEvent, replayLastEvent, restoreSockets } from './realtime'
import { getScenario, isScenarioId, SCENARIOS, setScenario, type ScenarioId } from './scenarios'

/**
 * `window.__mocks`: control surface for demos and E2E tests. Every action changes the
 * simulated backend (db) and/or emits through the simulated Socket.IO server; nothing here
 * touches the app's cache or UI, so the app observes changes exactly as it would in production.
 */
export interface MocksControl {
  readonly scenarios: typeof SCENARIOS
  getScenario(): ScenarioId
  setScenario(id: ScenarioId): void
  /** Restores the seed database and the `default` scenario. */
  reset(): void
  getState(): DbState
  getNft(id: string): Nft | undefined
  /** Changes price and/or availability of an edition (first edition by default). Emits `nft.updated`. */
  updateNft(nftId: string, patch: { editionId?: string; price?: string; available?: number }): Nft
  /** Resolves a pending order (no-op on terminal orders). Emits `order.updated`. */
  resolveOrder(orderId: string, outcome: 'confirmed' | 'rejected'): Order
  /** Expires every session server-side: next authenticated request answers 401. */
  expireSessions(): void
  /** Drops every wallet connection server-side (the wallet disconnected on its side): orders answer 409. */
  disconnectWallets(): void
  /** Re-emits the last event (same `eventId`). */
  replayLastEvent(type?: RealtimeEvent['type']): RealtimeEvent | null
  /** Emits an `nft.updated` with an older version. */
  emitStaleNftEvent(nftId: string): RealtimeEvent | null
  /** Closes all sockets; reconnection attempts are held until `restoreSocket()` answers them. */
  dropSocket(): void
  restoreSocket(): void
  connectedSockets(): Array<{ userId: string | null }>
}

export function createMocksControl(): MocksControl {
  return {
    scenarios: SCENARIOS,
    getScenario,
    setScenario(id) {
      if (!isScenarioId(id)) throw new Error(`Unknown scenario "${id}"`)
      setScenario(id)
    },
    reset() {
      clearOrderTimers()
      resetDb()
      setScenario('default')
      restoreSockets()
    },
    getState: () => structuredClone(db()),
    getNft: (id) => structuredClone(findNft(id)),
    updateNft(nftId, patch) {
      const nft = findNft(nftId)
      if (!nft) throw new Error(`NFT ${nftId} not found`)
      const editionId = patch.editionId ?? nft.editions[0].id
      return mutateNft(nftId, (draft) => {
        const edition = draft.editions.find((e) => e.id === editionId)
        if (!edition) throw new Error(`Edition ${editionId} not found`)
        if (patch.price !== undefined) edition.price = patch.price
        if (patch.available !== undefined) edition.available = Math.max(0, Math.min(edition.supply, patch.available))
      })
    },
    resolveOrder: (orderId, outcome) => resolveDbOrder(orderId, outcome),
    expireSessions() {
      const past = new Date(Date.now() - 1_000).toISOString()
      for (const session of db().sessions) session.expiresAt = past
      persist()
    },
    disconnectWallets() {
      db().walletConnections = []
      persist()
    },
    replayLastEvent: (type) => replayLastEvent(type ? (e) => e.type === type : undefined),
    emitStaleNftEvent,
    dropSocket: dropSockets,
    restoreSocket: restoreSockets,
    connectedSockets: connectedPeers,
  }
}

declare global {
  interface Window {
    __mocks?: MocksControl
  }
}
