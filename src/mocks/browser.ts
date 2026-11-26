import { setupWorker } from 'msw/browser'
import { createMocksControl } from './control'
import { resumePendingOrders } from './db/commerce'
import { resetDb } from './db/store'
import { accountHandlers } from './handlers/account'
import { authHandlers } from './handlers/auth'
import { cartHandlers, favoritesHandlers } from './handlers/cart'
import { catalogHandlers } from './handlers/catalog'
import { orderHandlers } from './handlers/orders'
import { socketHandler, startRealtimeBridge } from './realtime'
import { getScenario, isScenarioId, setScenario } from './scenarios'

export const handlers = [
  ...authHandlers,
  ...catalogHandlers,
  ...favoritesHandlers,
  ...cartHandlers,
  ...orderHandlers,
  ...accountHandlers,
  socketHandler,
]

/**
 * Starts MSW (REST through the Service Worker, WebSocket through in-page interception).
 * URL controls: `?scenario=<id>` selects (and persists) a scenario; `?mocks=reset` restores
 * the seed database. Must resolve before the app creates its Socket.IO client.
 */
export async function startMocks() {
  const params = new URLSearchParams(location.search)
  if (params.get('mocks') === 'reset') {
    resetDb()
    setScenario('default')
  }
  const scenario = params.get('scenario')
  if (scenario) {
    if (isScenarioId(scenario)) {
      if (scenario !== getScenario()) setScenario(scenario)
    } else {
      console.warn(`[mocks] unknown scenario "${scenario}", keeping "${getScenario()}"`)
    }
  }

  startRealtimeBridge()
  const worker = setupWorker(...handlers)
  await worker.start({
    onUnhandledFrame: 'bypass',
    quiet: import.meta.env.PROD,
  })
  resumePendingOrders()
  window.__mocks = createMocksControl()
  console.info(`[mocks] enabled, scenario "${getScenario()}"`)
}
