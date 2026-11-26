/**
 * Minimal stand-in for `tough-cookie`, aliased in `vite.config.ts`.
 *
 * MSW uses `tough-cookie` (plus `tldts`, ~290 kB of public-suffix data) only to expose the request
 * cookies to handlers and to store `Set-Cookie` from mocked responses. The simulated API
 * authenticates with a bearer token and never reads or sets cookies, so the real jar is dead
 * weight in the mock chunk. Handlers that need cookies would have to drop this alias.
 */
export class Cookie {
  static fromJSON() {
    return null
  }
  toJSON() {
    return {}
  }
}

export class MemoryCookieStore {
  idx: Record<string, unknown> = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) {}
  getCookiesSync() {
    return []
  }
  async setCookie() {}
}
