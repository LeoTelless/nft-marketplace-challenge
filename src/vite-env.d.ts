/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Enables the MSW network mocks (REST + Socket.IO). "true" in dev and in the demo build. */
  readonly VITE_ENABLE_MOCKS?: string
  /** Base URL of the REST API. Defaults to "/api" (same origin, intercepted by MSW). */
  readonly VITE_API_URL?: string
  /** Origin of the Socket.IO server. Defaults to the page origin. */
  readonly VITE_SOCKET_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
