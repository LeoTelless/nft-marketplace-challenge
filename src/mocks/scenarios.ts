/**
 * Deterministic mock scenarios. Selected with `?scenario=<id>` (persisted in localStorage)
 * or `window.__mocks.setScenario(id)`. Latencies follow fixed sequences (no randomness),
 * so a scenario always produces the same timeline.
 *
 * "One-shot" scenarios trigger once per activation (e.g. the first order attempt) and then
 * behave like `default`, so the recovery path can be exercised; re-selecting the scenario
 * (or `reset()`) re-arms them.
 */
export const SCENARIOS = {
  default: 'Success with a small, deterministic latency (120-300 ms). Payments confirm.',
  instant: 'Success with no latency.',
  empty: 'Catalog returns no results.',
  slow: 'Every request takes 2.5 s (skeletons, background updates).',
  'variable-latency': 'Latency cycles 900/150/1800/400/60/1200 ms.',
  'out-of-order': 'Catalog lists alternate 1600 ms and 150 ms: later requests resolve first.',
  'request-timeout': 'Reads hang for 20 s (longer than the client timeout).',
  offline: 'Every request fails at network level; the socket refuses connections.',
  'server-error': 'Every API request answers 500.',
  flaky: 'The first 2 attempts of each endpoint answer 503, then succeed.',
  'session-expired': 'One-shot: the next authenticated request answers 401 session_expired.',
  forbidden: 'Private endpoints answer 403.',
  'register-conflict': 'Register always answers 409 email_conflict.',
  'validation-error': 'Register, profile, password and wallet mutations answer 422 with field errors.',
  'coupon-invalid': 'Any coupon answers 422 coupon_invalid.',
  'coupon-expired': 'Any coupon answers 422 coupon_expired.',
  'price-changed': 'One-shot: on the first order attempt the price of the first item rises 15% (nft.updated) and the order answers 409 quote_outdated.',
  'sold-out': 'One-shot: on the first order attempt the first item sells out (nft.updated) and the order answers 409 availability_conflict.',
  'order-timeout': 'One-shot: the first order is created but its response is lost (network error); retrying with the same key recovers it.',
  'payment-declined': 'Orders resolve to rejected.',
  'order-pending': 'Orders stay pending until resolved via window.__mocks.resolveOrder().',
  'wallet-declined': 'Wallet connection answers 422 wallet_rejected.',
} as const satisfies Record<string, string>

export type ScenarioId = keyof typeof SCENARIOS

const SCENARIO_KEY = 'nft-mocks:scenario'
const ONE_SHOT_KEY = 'nft-mocks:scenario-consumed'

export function isScenarioId(value: string): value is ScenarioId {
  return Object.hasOwn(SCENARIOS, value)
}

function readScenario(): ScenarioId {
  try {
    const stored = localStorage.getItem(SCENARIO_KEY)
    if (stored && isScenarioId(stored)) return stored
  } catch {
    // ignore
  }
  return 'default'
}

let current: ScenarioId = readScenario()
let consumed = new Set<string>(readConsumed())
let requestSeq = 0
const attemptsByRoute = new Map<string, number>()

function readConsumed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ONE_SHOT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function getScenario(): ScenarioId {
  return current
}

/** Activates a scenario and re-arms its one-shot behaviors. */
export function setScenario(id: ScenarioId) {
  current = id
  consumed = new Set()
  requestSeq = 0
  attemptsByRoute.clear()
  try {
    localStorage.setItem(SCENARIO_KEY, id)
    localStorage.removeItem(ONE_SHOT_KEY)
  } catch {
    // ignore
  }
}

export function is(id: ScenarioId): boolean {
  return current === id
}

/** True the first time it is called for the active one-shot scenario, false afterwards. */
export function consumeOneShot(id: ScenarioId): boolean {
  if (current !== id || consumed.has(id)) return false
  consumed.add(id)
  try {
    localStorage.setItem(ONE_SHOT_KEY, JSON.stringify([...consumed]))
  } catch {
    // ignore
  }
  return true
}

const VARIABLE_LATENCIES = [900, 150, 1800, 400, 60, 1200]

/** Latency (ms) for the next request. */
export function nextLatency(info: { method: string; isCatalogList: boolean }): number {
  const seq = requestSeq++
  switch (current) {
    case 'instant':
      return 0
    case 'slow':
      return 2_500
    case 'variable-latency':
      return VARIABLE_LATENCIES[seq % VARIABLE_LATENCIES.length]
    case 'out-of-order':
      return info.isCatalogList ? (seq % 2 === 0 ? 1_600 : 150) : 120
    case 'request-timeout':
      return info.method === 'GET' ? 20_000 : 120
    default:
      return 120 + ((seq * 37) % 181)
  }
}

/** For `flaky`: number of previous attempts on this route (method + path). */
export function countAttempt(routeKey: string): number {
  const attempts = attemptsByRoute.get(routeKey) ?? 0
  attemptsByRoute.set(routeKey, attempts + 1)
  return attempts
}

export const ORDER_RESOLUTION_DELAY_MS = 2_500
