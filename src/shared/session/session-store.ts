/**
 * Client-side session handle: only the opaque token (and the visitor cart id) is persisted.
 * The user itself is always recovered from `GET /session`, so a stale or forged value
 * in storage can never show another user's data.
 */
const TOKEN_KEY = 'nft.session.token'
const GUEST_CART_KEY = 'nft.cart.guestId'

type Listener = () => void
const listeners = new Set<Listener>()

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

let token: string | null = readStorage(TOKEN_KEY)

function notify() {
  for (const listener of listeners) listener()
}

export const sessionStore = {
  getToken(): string | null {
    return token
  },
  setToken(next: string | null) {
    if (next === token) return
    token = next
    try {
      if (next) localStorage.setItem(TOKEN_KEY, next)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      // Storage unavailable (private mode): keep the in-memory session only.
    }
    notify()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Visitor cart id, created lazily and sent as `X-Cart-Id`. */
  getGuestCartId(): string {
    let id = readStorage(GUEST_CART_KEY)
    if (!id) {
      id = `guest_${crypto.randomUUID()}`
      try {
        localStorage.setItem(GUEST_CART_KEY, id)
      } catch {
        // ignore
      }
    }
    return id
  },
  /** After a merge (login) or logout the old visitor cart must not be reused. */
  rotateGuestCartId() {
    try {
      localStorage.removeItem(GUEST_CART_KEY)
    } catch {
      // ignore
    }
  },
}

export type SessionExpiredDetail = { reason: 'session_expired' | 'unauthorized' }

/**
 * Raised by the HTTP layer (401 on an authenticated request) and by the realtime client
 * (socket handshake rejected). The app listens to it to clear private caches and send
 * the user to login, preserving the current location.
 */
export const sessionEvents = new EventTarget()
export const SESSION_EXPIRED_EVENT = 'session:expired'

export function emitSessionExpired(detail: SessionExpiredDetail) {
  sessionEvents.dispatchEvent(new CustomEvent<SessionExpiredDetail>(SESSION_EXPIRED_EVENT, { detail }))
}

export function onSessionExpired(listener: (detail: SessionExpiredDetail) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<SessionExpiredDetail>).detail)
  sessionEvents.addEventListener(SESSION_EXPIRED_EVENT, handler)
  return () => sessionEvents.removeEventListener(SESSION_EXPIRED_EVENT, handler)
}
