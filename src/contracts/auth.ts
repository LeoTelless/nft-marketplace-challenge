import { z } from 'zod'
import { idSchema, isoDateSchema } from './common'

export const userSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  avatarUrl: z.string().nullable(),
})
export type User = z.infer<typeof userSchema>

/** `POST /auth/login` (200) and `POST /auth/register` (201). */
export const sessionSchema = z.object({
  token: z.string().min(1),
  expiresAt: isoDateSchema,
  user: userSchema,
})
export type Session = z.infer<typeof sessionSchema>

/** `GET /session`: current session (token not echoed). 401 `session_expired` / `unauthorized`. */
export const sessionInfoSchema = sessionSchema.omit({ token: true })
export type SessionInfo = z.infer<typeof sessionInfoSchema>

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter uma letra')
  .regex(/\d/, 'A senha deve conter um número')

/** 401 `invalid_credentials`. */
export const loginRequestSchema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
  /** Visitor cart to merge into the account cart. */
  guestCartId: z.string().optional(),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** 409 `email_conflict`, 422 `validation_error`. */
export const registerRequestSchema = z.object({
  name: z.string().trim().min(2, 'Informe um nome com pelo menos 2 caracteres').max(60, 'Use no máximo 60 caracteres'),
  email: z.email('Informe um e-mail válido'),
  password: passwordSchema,
  guestCartId: z.string().optional(),
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>
