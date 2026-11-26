import { delay, HttpResponse, type DefaultBodyType, type HttpResponseResolver, type PathParams } from 'msw'
import type { z } from 'zod'
import { DEFAULT_API_BASE_URL, type ApiErrorBody, type ApiErrorCode, type FieldErrors } from '@/contracts'
import { db, persist } from '../db/store'
import type { DbSession, DbUser } from '../db/types'
import { consumeOneShot, countAttempt, is, nextLatency } from '../scenarios'

const API_BASE = (import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')

/** Full handler path for an API path (e.g. `/nfts/:id`). */
export function api(path: string): string {
  return `${API_BASE}${path}`
}

/** Thrown inside handlers; converted to the standard error envelope by `route()`. */
export class MockHttpError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly extras: { fieldErrors?: FieldErrors; details?: Record<string, unknown> }

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    extras: { fieldErrors?: FieldErrors; details?: Record<string, unknown> } = {},
  ) {
    super(message)
    this.status = status
    this.code = code
    this.extras = extras
  }
}

export function errorResponse(status: number, code: ApiErrorCode, message: string, extras: MockHttpError['extras'] = {}) {
  const body: ApiErrorBody = {
    error: { status, code, message, retryable: status >= 500, ...extras },
  }
  return HttpResponse.json(body, { status })
}

export function validationError(fieldErrors: FieldErrors, message = 'Some fields are invalid'): never {
  throw new MockHttpError(422, 'validation_error', message, { fieldErrors })
}

/** Parses a JSON body with a contract schema; 422 with field errors on failure. */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    throw new MockHttpError(400, 'bad_request', 'Body must be valid JSON')
  }
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const fieldErrors: FieldErrors = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.') || '_'
      ;(fieldErrors[key] ??= []).push(issue.message)
    }
    validationError(fieldErrors)
  }
  return parsed.data
}

const PRIVATE_PREFIXES = ['/favorites', '/orders', '/profile', '/wallets']

interface RouteOptions {
  /** Requires an authenticated user (401 otherwise) and makes the route subject to `forbidden`. */
  auth?: boolean
}

export interface RouteContext<Params extends PathParams> {
  request: Request
  params: Params
  user: DbUser | null
  session: DbSession | null
}

/**
 * Wraps a resolver with the cross-cutting scenario behaviors (latency, offline, 5xx, flaky,
 * forbidden, expired session) and converts thrown `MockHttpError`s into error responses.
 */
export function route<Params extends PathParams = PathParams>(
  resolver: (ctx: RouteContext<Params>) => Promise<Response> | Response,
  options: RouteOptions = {},
): HttpResponseResolver<Params, DefaultBodyType> {
  return async ({ request, params }) => {
    const url = new URL(request.url)
    const path = url.pathname.slice(new URL(API_BASE, location.origin).pathname.length)
    const isCatalogList = request.method === 'GET' && path === '/nfts'

    await delay(nextLatency({ method: request.method, isCatalogList }))

    if (is('offline')) return HttpResponse.error()
    if (is('server-error')) return errorResponse(500, 'server_error', 'Internal server error (simulated)')
    if (is('flaky') && countAttempt(`${request.method} ${path}`) < 2) {
      return errorResponse(503, 'service_unavailable', 'Service temporarily unavailable (simulated)')
    }

    try {
      const { user, session } = authenticate(request, options.auth ?? false)
      if (options.auth && is('forbidden') && PRIVATE_PREFIXES.some((p) => path.startsWith(p))) {
        throw new MockHttpError(403, 'forbidden', 'You are not allowed to access this resource (simulated)')
      }
      return await resolver({ request, params: params as Params, user, session })
    } catch (error) {
      if (error instanceof MockHttpError) {
        return errorResponse(error.status, error.code, error.message, error.extras)
      }
      console.error('[mocks] unexpected handler error', error)
      return errorResponse(500, 'server_error', 'Unexpected mock error')
    }
  }
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization')
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

export function findValidSession(token: string | null): { session: DbSession; user: DbUser } | null {
  if (!token) return null
  const state = db()
  const session = state.sessions.find((s) => s.token === token)
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null
  const user = state.users.find((u) => u.id === session.userId)
  return user ? { session, user } : null
}

function authenticate(request: Request, required: boolean): { user: DbUser | null; session: DbSession | null } {
  const token = bearerToken(request)
  if (!token) {
    if (required) throw new MockHttpError(401, 'unauthorized', 'Authentication required')
    return { user: null, session: null }
  }

  const state = db()
  if (consumeOneShot('session-expired')) {
    state.sessions = state.sessions.filter((s) => s.token !== token)
    persist()
  }

  const found = findValidSession(token)
  if (!found) {
    state.sessions = state.sessions.filter((s) => s.token !== token)
    persist()
    // A stale token is an error even on public routes: the client must learn the session is gone.
    throw new MockHttpError(401, 'session_expired', 'Your session has expired')
  }
  return found
}

export function requireUser(ctx: { user: DbUser | null }): DbUser {
  if (!ctx.user) throw new MockHttpError(401, 'unauthorized', 'Authentication required')
  return ctx.user
}

export function requireSession(ctx: { user: DbUser | null; session: DbSession | null }): { user: DbUser; session: DbSession } {
  const user = requireUser(ctx)
  if (!ctx.session) throw new MockHttpError(401, 'unauthorized', 'Authentication required')
  return { user, session: ctx.session }
}

export function now(): string {
  return new Date().toISOString()
}

/** Small non-cryptographic hash (djb2), for fingerprints and idempotency body hashes. */
export function hashString(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash + value.charCodeAt(i)) | 0
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** Stable JSON (sorted keys) so equivalent bodies hash the same. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : 1))
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function hashPassword(salt: string, password: string): Promise<string> {
  return sha256Hex(`${salt}:${password}`)
}

export function randomHex(bytes: number): string {
  return [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')
}
