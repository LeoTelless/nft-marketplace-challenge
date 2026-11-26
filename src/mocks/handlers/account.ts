import { http, HttpResponse } from 'msw'
import {
  changePasswordRequestSchema,
  connectWalletRequestSchema,
  createWalletRequestSchema,
  endpoints,
  updateAvatarRequestSchema,
  updateProfileRequestSchema,
  updateWalletRequestSchema,
  type Profile,
  type WalletConnection,
  type WalletList,
} from '@/contracts'
import { findWalletConnection, setWalletConnection } from '../db/commerce'
import { db, nextId, persist } from '../db/store'
import type { DbUser, DbWallet } from '../db/types'
import { is } from '../scenarios'
import { api, hashPassword, MockHttpError, now, parseBody, randomHex, requireSession, requireUser, route, validationError } from './utils'

function profileOf(user: DbUser): Profile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username ?? '',
    ensName: user.ensName ?? '',
    bio: user.bio,
    avatarUrl: user.avatarUrl,
  }
}

function publicWallet(wallet: DbWallet) {
  const { userId: _userId, ...rest } = wallet
  return rest
}

function walletsOf(userId: string) {
  return db().wallets.filter((w) => w.userId === userId)
}

function findWallet(userId: string, id: string): DbWallet {
  const wallet = db().wallets.find((w) => w.id === id)
  if (!wallet) throw new MockHttpError(404, 'not_found', 'Wallet not found')
  if (wallet.userId !== userId) throw new MockHttpError(403, 'forbidden', 'This wallet belongs to another account')
  return wallet
}

function assertAddressFree(userId: string, address: string, exceptId?: string) {
  const clash = walletsOf(userId).some((w) => w.id !== exceptId && w.address.toLowerCase() === address.toLowerCase())
  if (clash) {
    throw new MockHttpError(409, 'wallet_conflict', 'This address is already registered', {
      fieldErrors: { address: ['Este endereço já está cadastrado'] },
    })
  }
}

export const accountHandlers = [
  http.get(
    api(endpoints.profile),
    route((ctx) => HttpResponse.json(profileOf(requireUser(ctx))), { auth: true }),
  ),

  http.patch(
    api(endpoints.profile),
    route(
      async (ctx) => {
        const user = requireUser(ctx)
        const body = await parseBody(ctx.request, updateProfileRequestSchema)
        if (is('validation-error')) validationError({ name: ['Este nome não é permitido (regra simulada do servidor)'] })
        const taken = db().users.some((u) => u.id !== user.id && u.email.toLowerCase() === body.email.toLowerCase())
        if (taken) {
          throw new MockHttpError(409, 'email_conflict', 'This email is used by another account', {
            fieldErrors: { email: ['Este e-mail é usado por outra conta'] },
          })
        }
        Object.assign(user, { name: body.name, email: body.email, username: body.username, ensName: body.ensName, bio: body.bio })
        persist()
        return HttpResponse.json(profileOf(user))
      },
      { auth: true },
    ),
  ),

  http.put(
    api(endpoints.avatar),
    route(
      async (ctx) => {
        const user = requireUser(ctx)
        const body = await parseBody(ctx.request, updateAvatarRequestSchema)
        user.avatarUrl = body.dataUrl
        persist()
        return HttpResponse.json(profileOf(user))
      },
      { auth: true },
    ),
  ),

  http.post(
    api(endpoints.password),
    route(
      async (ctx) => {
        const user = requireUser(ctx)
        const body = await parseBody(ctx.request, changePasswordRequestSchema)
        if (is('validation-error')) validationError({ newPassword: ['Esta senha foi usada recentemente (regra simulada do servidor)'] })
        if ((await hashPassword(user.salt, body.currentPassword)) !== user.passwordHash) {
          validationError({ currentPassword: ['A senha atual está incorreta'] })
        }
        if (body.currentPassword === body.newPassword) {
          validationError({ newPassword: ['A nova senha deve ser diferente da atual'] })
        }
        user.salt = randomHex(6)
        user.passwordHash = await hashPassword(user.salt, body.newPassword)
        // Other sessions of this user are revoked; the current one stays valid.
        db().sessions = db().sessions.filter((s) => s.userId !== user.id || s.token === ctx.session?.token)
        persist()
        return new HttpResponse(null, { status: 204 })
      },
      { auth: true },
    ),
  ),

  http.get(
    api(endpoints.wallets),
    route(
      (ctx) => {
        const user = requireUser(ctx)
        const items = walletsOf(user.id)
          .sort((a, b) => (a.role === b.role ? 0 : a.role === 'primary' ? -1 : 1))
          .map(publicWallet)
        return HttpResponse.json({ items } satisfies WalletList)
      },
      { auth: true },
    ),
  ),

  http.post(
    api(endpoints.wallets),
    route(
      async (ctx) => {
        const user = requireUser(ctx)
        const body = await parseBody(ctx.request, createWalletRequestSchema)
        if (is('validation-error')) validationError({ address: ['Este endereço foi sinalizado (regra simulada do servidor)'] })
        if (walletsOf(user.id).some((w) => w.role === body.role)) {
          throw new MockHttpError(409, 'wallet_conflict', `You already have a ${body.role} wallet`, {
            fieldErrors: { role: [body.role === 'primary' ? 'Você já tem uma carteira principal' : 'Você já tem uma carteira secundária'] },
          })
        }
        assertAddressFree(user.id, body.address)
        const timestamp = now()
        const wallet: DbWallet = { id: nextId('wallet'), userId: user.id, ...body, createdAt: timestamp, updatedAt: timestamp }
        db().wallets.push(wallet)
        persist()
        return HttpResponse.json(publicWallet(wallet), { status: 201 })
      },
      { auth: true },
    ),
  ),

  http.patch(
    api(endpoints.wallet(':id')),
    route<{ id: string }>(
      async (ctx) => {
        const user = requireUser(ctx)
        const wallet = findWallet(user.id, ctx.params.id)
        const body = await parseBody(ctx.request, updateWalletRequestSchema)
        if (is('validation-error')) validationError({ label: ['Este apelido não é permitido (regra simulada do servidor)'] })
        if (body.address) assertAddressFree(user.id, body.address, wallet.id)
        if (body.role && body.role !== wallet.role) {
          const other = walletsOf(user.id).find((w) => w.id !== wallet.id && w.role === body.role)
          // Promoting/demoting swaps roles so there is always at most one of each.
          if (other) other.role = wallet.role
        }
        Object.assign(wallet, body, { updatedAt: now() })
        persist()
        return HttpResponse.json(publicWallet(wallet))
      },
      { auth: true },
    ),
  ),

  http.post(
    api(endpoints.walletConnect(':id')),
    route<{ id: string }>(
      async (ctx) => {
        const { user, session } = requireSession(ctx)
        const wallet = findWallet(user.id, ctx.params.id)
        const body = await parseBody(ctx.request, connectWalletRequestSchema)
        if (is('wallet-declined')) {
          // Declining in the wallet leaves the session without a connected wallet.
          setWalletConnection(session.token, null)
          throw new MockHttpError(422, 'wallet_rejected', 'The connection request was declined in the wallet (simulated)')
        }
        if (!wallet.networks.includes(body.network)) {
          validationError({ network: [`${wallet.label} não opera na rede ${body.network}`] })
        }
        const connection: WalletConnection = { walletId: wallet.id, network: body.network, connectedAt: now() }
        setWalletConnection(session.token, { userId: user.id, ...connection })
        return HttpResponse.json(connection)
      },
      { auth: true },
    ),
  ),

  http.delete(
    api(endpoints.walletConnect(':id')),
    route<{ id: string }>(
      (ctx) => {
        const { user, session } = requireSession(ctx)
        const wallet = findWallet(user.id, ctx.params.id)
        if (findWalletConnection(session.token)?.walletId === wallet.id) setWalletConnection(session.token, null)
        return new HttpResponse(null, { status: 204 })
      },
      { auth: true },
    ),
  ),
]
