/**
 * Per-user client state that must survive a refresh or an expired session (checkout draft,
 * purchase attempt), kept in `sessionStorage` under a key that includes the user id: data of
 * one user is never read for another one, and logout wipes every entry.
 */
const PREFIX = 'nft.user.'

function key(userId: string, name: string) {
  return `${PREFIX}${userId}.${name}`
}

export const userStorage = {
  get<T>(userId: string, name: string): T | null {
    try {
      const raw = sessionStorage.getItem(key(userId, name))
      return raw ? (JSON.parse(raw) as T) : null
    } catch {
      return null
    }
  },
  set(userId: string, name: string, value: unknown) {
    try {
      sessionStorage.setItem(key(userId, name), JSON.stringify(value))
    } catch {
      // Storage unavailable: the value only lives for this render tree.
    }
  },
  remove(userId: string, name: string) {
    try {
      sessionStorage.removeItem(key(userId, name))
    } catch {
      // ignore
    }
  },
  /** Removes the entries of every user except `keepUserId` (logout: `null`, wipes all). */
  clearOthers(keepUserId: string | null) {
    try {
      for (const storageKey of Object.keys(sessionStorage)) {
        if (!storageKey.startsWith(PREFIX)) continue
        if (keepUserId && storageKey.startsWith(`${PREFIX}${keepUserId}.`)) continue
        sessionStorage.removeItem(storageKey)
      }
    } catch {
      // ignore
    }
  },
}
