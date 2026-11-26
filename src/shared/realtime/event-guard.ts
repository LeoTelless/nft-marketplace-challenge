/**
 * Drops duplicate and out-of-date events.
 * - Duplicates: same `eventId` already seen (bounded memory, oldest ids forgotten first).
 * - Stale: `version` not greater than the highest version seen for that resource.
 * One guard lives per socket connection (per session), so a new user starts clean.
 */
export class EventGuard {
  private readonly seenIds = new Set<string>()
  private readonly versions = new Map<string, number>()

  private readonly maxRemembered: number

  constructor(maxRemembered = 1_000) {
    this.maxRemembered = maxRemembered
  }

  /** Returns true when the event must be applied (and records it). */
  accept(event: { eventId: string; version: number; resource: { type: string; id: string } }): boolean {
    if (this.seenIds.has(event.eventId)) return false
    this.remember(event.eventId)

    const key = `${event.resource.type}:${event.resource.id}`
    const current = this.versions.get(key) ?? 0
    if (event.version <= current) return false
    this.versions.set(key, event.version)
    return true
  }


  clear() {
    this.seenIds.clear()
    this.versions.clear()
  }

  private remember(id: string) {
    this.seenIds.add(id)
    if (this.seenIds.size > this.maxRemembered) {
      const oldest = this.seenIds.values().next().value
      if (oldest !== undefined) this.seenIds.delete(oldest)
    }
  }
}
