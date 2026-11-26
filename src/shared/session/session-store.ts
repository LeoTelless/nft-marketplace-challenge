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

function writeStorage(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode): keep the in-memory value only.
  }
}

let token: string | null = readStorage(TOKEN_KEY)
let guestCartId: string | null = readStorage(GUEST_CART_KEY)

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
    writeStorage(TOKEN_KEY, next)
    notify()
  },
  /** Notified on token and visitor cart id changes. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** Visitor cart id, created lazily and sent as `X-Cart-Id`. Stable until rotated. */
  getGuestCartId(): string {
    if (!guestCartId) {
      guestCartId = readStorage(GUEST_CART_KEY) ?? `guest_${crypto.randomUUID()}`
      writeStorage(GUEST_CART_KEY, guestCartId)
    }
    return guestCartId
  },
  /** After a merge (login) or logout the old visitor cart must not be reused. */
  rotateGuestCartId() {
    guestCartId = null
    writeStorage(GUEST_CART_KEY, null)
    notify()
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
