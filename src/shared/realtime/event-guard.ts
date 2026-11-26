/**
 * Drops duplicate and out-of-date events.
 * - Duplicates: same `eventId` already seen (bounded memory, oldest ids forgotten first).
 * - Stale: `version` not greater than the highest version known for that resource, where
 *   "known" is the maximum of what this guard saw (events, seeds) and the version passed by
 *   the caller (the one in the query cache, i.e. what REST returned).
 *
 * An optional storage keeps the guard across page reloads (see `realtime-client.ts`).
 */
export interface GuardSnapshot {
  ids: string[]
  versions: Array<[string, number]>
}

export interface GuardStorage {
  load(): GuardSnapshot | null
  save(snapshot: GuardSnapshot): void
}

interface GuardedEvent {
  eventId: string
  version: number
  resource: { type: string; id: string }
}

export class EventGuard {
  private readonly seenIds = new Set<string>()
  private readonly versions = new Map<string, number>()
  private readonly maxRemembered: number
  private readonly storage: GuardStorage | null

  constructor(options: { maxRemembered?: number; storage?: GuardStorage } = {}) {
    this.maxRemembered = options.maxRemembered ?? 1_000
    this.storage = options.storage ?? null
    const snapshot = this.storage?.load()
    if (snapshot) {
      for (const id of snapshot.ids) this.seenIds.add(id)
      for (const [key, version] of snapshot.versions) this.versions.set(key, version)
      this.trim()
    }
  }

  /** Returns true when the event must be applied (and records it). `knownVersion`: version already in the cache. */
  accept(event: GuardedEvent, knownVersion = 0): boolean {
    if (this.seenIds.has(event.eventId)) return false
    this.seenIds.add(event.eventId)

    const key = keyOf(event.resource.type, event.resource.id)
    const current = Math.max(this.versions.get(key) ?? 0, knownVersion)
    const fresh = event.version > current
    if (fresh) this.setVersion(key, event.version)
    this.trim()
    this.save()
    return fresh
  }

  /** Records a version learned outside the socket (REST snapshot): later events must be newer. */
  observe(type: string, id: string, version: number) {
    const key = keyOf(type, id)
    if (version > (this.versions.get(key) ?? 0)) this.setVersion(key, version)
    this.trim()
    this.save()
  }

  /** Forgets everything (in memory only; the storage is left to its owner). */
  clear() {
    this.seenIds.clear()
    this.versions.clear()
  }

  private setVersion(key: string, version: number) {
    // Re-insert so the map stays ordered from least to most recently updated.
    this.versions.delete(key)
    this.versions.set(key, version)
  }

  private trim() {
    for (const collection of [this.seenIds, this.versions] as const) {
      while (collection.size > this.maxRemembered) {
        const oldest = collection.keys().next().value
        if (oldest === undefined) break
        collection.delete(oldest)
      }
    }
  }

  private save() {
    this.storage?.save({ ids: [...this.seenIds], versions: [...this.versions] })
  }
}

function keyOf(type: string, id: string) {
  return `${type}:${id}`
}

/** `sessionStorage` entry (per tab, survives reloads). Failures only lose the persistence. */
export function sessionGuardStorage(key: string): GuardStorage {
  return {
    load() {
      try {
        const raw = sessionStorage.getItem(key)
        if (!raw) return null
        const parsed = JSON.parse(raw) as Partial<GuardSnapshot>
        if (!Array.isArray(parsed.ids) || !Array.isArray(parsed.versions)) return null
        return { ids: parsed.ids, versions: parsed.versions }
      } catch {
        return null
      }
    },
    save(snapshot) {
      try {
        sessionStorage.setItem(key, JSON.stringify(snapshot))
      } catch {
        // Storage unavailable or full: the guard keeps working in memory.
      }
    },
  }
}
