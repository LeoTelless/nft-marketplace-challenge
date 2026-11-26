import type { Nft, Order } from '@/contracts'
import { COUPON_FIXTURES, FAVORITE_FIXTURES, USER_FIXTURES, WALLET_FIXTURES } from '../fixtures/accounts'
import { createNftFixtures, deriveNftAggregates } from '../fixtures/nfts'
import type { DbState } from './types'

/**
 * Single in-memory database shared by every handler (REST and Socket.IO), persisted in
 * localStorage so the simulated backend survives a page refresh. `resetDb()` restores the
 * known seed state exactly.
 *
 * Every NFT or order mutation goes through `mutateNft` / `mutateOrder`, which bump the
 * resource version and notify `onDbChange` listeners: the socket server turns those into
 * `nft.updated` / `order.updated` events, so REST and events never diverge.
 */
const STORAGE_KEY = 'nft-mocks:db:v1'
const MAX_QUOTES = 100

export type DbChange =
  | { type: 'nft'; nft: Nft; previous: Nft }
  | { type: 'order'; order: Order; userId: string }

type ChangeListener = (change: DbChange) => void
const listeners = new Set<ChangeListener>()

export function onDbChange(listener: ChangeListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function createSeedState(): DbState {
  return {
    schemaVersion: 1,
    seq: 1000,
    eventSeq: 1,
    users: structuredClone(USER_FIXTURES),
    sessions: [],
    nfts: createNftFixtures(),
    favorites: structuredClone(FAVORITE_FIXTURES),
    carts: [],
    quotes: [],
    orders: [],
    wallets: structuredClone(WALLET_FIXTURES),
    coupons: structuredClone(COUPON_FIXTURES),
  }
}

function load(): DbState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DbState
      if (parsed.schemaVersion === 1) return parsed
    }
  } catch {
    // Corrupted storage: fall back to the seed.
  }
  return createSeedState()
}

let state: DbState = load()

export function db(): DbState {
  return state
}

export function persist() {
  if (state.quotes.length > MAX_QUOTES) state.quotes = state.quotes.slice(-MAX_QUOTES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Quota exceeded: keep working in memory.
  }
}

export function resetDb() {
  state = createSeedState()
  persist()
}

/** Sequential, persisted ids: deterministic across runs from the same seed. */
export function nextId(prefix: string): string {
  state.seq += 1
  return `${prefix}_${state.seq.toString(36)}`
}

export function nextEventId(): string {
  const id = `evt_${state.eventSeq.toString().padStart(6, '0')}`
  state.eventSeq += 1
  return id
}

export function findNft(id: string): Nft | undefined {
  return state.nfts.find((nft) => nft.id === id)
}

/** Applies `mutator` to a copy of the NFT, bumps its version, persists and notifies. */
export function mutateNft(id: string, mutator: (draft: Nft) => void): Nft {
  const index = state.nfts.findIndex((nft) => nft.id === id)
  if (index < 0) throw new Error(`NFT ${id} not found`)
  const previous = state.nfts[index]
  const draft = structuredClone(previous)
  mutator(draft)
  const next: Nft = { ...draft, ...deriveNftAggregates(draft.editions), version: previous.version + 1 }
  state.nfts[index] = next
  persist()
  for (const listener of listeners) listener({ type: 'nft', nft: next, previous })
  return next
}

/** Same contract for orders. Terminal orders are never mutated. */
export function mutateOrder(id: string, mutator: (draft: Order) => void): Order {
  const record = state.orders.find((o) => o.order.id === id)
  if (!record) throw new Error(`Order ${id} not found`)
  const draft = structuredClone(record.order)
  mutator(draft)
  record.order = { ...draft, version: record.order.version + 1, updatedAt: new Date().toISOString() }
  persist()
  for (const listener of listeners) listener({ type: 'order', order: record.order, userId: record.userId })
  return record.order
}

/** Notifies a newly created order (version 1). */
export function announceOrder(order: Order, userId: string) {
  for (const listener of listeners) listener({ type: 'order', order, userId })
}
