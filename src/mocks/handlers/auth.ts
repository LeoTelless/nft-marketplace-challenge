import { http, HttpResponse } from 'msw'
import { endpoints, HEADERS, loginRequestSchema, registerRequestSchema, type Session, type SessionInfo } from '@/contracts'
import { mergeGuestCart } from '../db/commerce'
import { db, nextId, persist } from '../db/store'
import type { DbUser } from '../db/types'
import { is } from '../scenarios'
import { api, hashPassword, MockHttpError, now, parseBody, randomHex, requireUser, route, validationError } from './utils'

const SESSION_TTL_MS = 2 * 60 * 60_000

export function publicUser(user: DbUser) {
  return { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl }
}

function openSession(user: DbUser): Session {
  const createdAt = new Date()
  const session = {
    token: `tok_${randomHex(24)}`,
    userId: user.id,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + SESSION_TTL_MS).toISOString(),
  }
  db().sessions.push(session)
  persist()
  return { token: session.token, expiresAt: session.expiresAt, user: publicUser(user) }
}

/** Initial handle derived from the e-mail (editable in the profile). */
function usernameFrom(email: string) {
  const base = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24)
  return base.length >= 3 ? base : `user.${base}`.slice(0, 30)
}

export const authHandlers = [
  http.post(
    api(endpoints.login),
    route(async ({ request }) => {
      const body = await parseBody(request, loginRequestSchema)
      const user = db().users.find((u) => u.email.toLowerCase() === body.email.toLowerCase())
      const valid = user && (await hashPassword(user.salt, body.password)) === user.passwordHash
      if (!user || !valid) throw new MockHttpError(401, 'invalid_credentials', 'Invalid email or password')
      mergeGuestCart(body.guestCartId ?? request.headers.get(HEADERS.cartId), user.id)
      return HttpResponse.json(openSession(user))
    }),
  ),

  http.post(
    api(endpoints.register),
    route(async ({ request }) => {
      const body = await parseBody(request, registerRequestSchema)
      if (is('validation-error')) validationError({ name: ['Este nome não é permitido (regra simulada do servidor)'] })
      const taken = db().users.some((u) => u.email.toLowerCase() === body.email.toLowerCase())
      if (taken || is('register-conflict')) {
        throw new MockHttpError(409, 'email_conflict', 'An account with this email already exists', {
          fieldErrors: { email: ['Este e-mail já está cadastrado'] },
        })
      }
      const salt = randomHex(6)
      const user: DbUser = {
        id: nextId('user'),
        name: body.name,
        email: body.email,
        username: usernameFrom(body.email),
        ensName: '',
        bio: '',
        avatarUrl: null,
        salt,
        passwordHash: await hashPassword(salt, body.password),
        createdAt: now(),
      }
      db().users.push(user)
      db().favorites[user.id] = []
      persist()
      mergeGuestCart(body.guestCartId ?? request.headers.get(HEADERS.cartId), user.id)
      return HttpResponse.json(openSession(user), { status: 201 })
    }),
  ),

  http.get(
    api(endpoints.session),
    route(
      ({ user, session }) => {
        const info: SessionInfo = { expiresAt: session!.expiresAt, user: publicUser(requireUser({ user })) }
        return HttpResponse.json(info)
      },
      { auth: true },
    ),
  ),

  http.post(
    api(endpoints.logout),
    route(
      ({ session }) => {
        db().sessions = db().sessions.filter((s) => s.token !== session?.token)
        db().walletConnections = db().walletConnections.filter((c) => c.sessionToken !== session?.token)
        persist()
        return new HttpResponse(null, { status: 204 })
      },
      { auth: true },
    ),
  ),
]
