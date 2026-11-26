/**
 * Tiny entry chunk: it only starts downloading the two big pieces in parallel, the application
 * (React, Router, Query, routes) and the mock layer (MSW, handlers, fixtures; a separate chunk,
 * loaded by dynamic `import()`), and renders once both are ready.
 *
 * Order guarantee: the mocks are running before the app renders, so before the first REST call
 * (Service Worker) and before the app creates its Socket.IO client, which is itself loaded with a
 * dynamic `import()` after render (engine.io captures `WebSocket` when the module loads).
 * Importing `./app` only builds the router: it makes no request and creates no socket.
 */
async function enableMocking() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== 'true') return
  const { startMocks } = await import('./mocks/browser')
  await startMocks()
}

const [{ mountApp }] = await Promise.all([import('./app'), enableMocking()])
mountApp()
