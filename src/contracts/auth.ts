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
  .min(8, 'Password must have at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')

/** 401 `invalid_credentials`. */
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  /** Visitor cart to merge into the account cart. */
  guestCartId: z.string().optional(),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** 409 `email_conflict`, 422 `validation_error`. */
export const registerRequestSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email(),
  password: passwordSchema,
  guestCartId: z.string().optional(),
})
export type RegisterRequest = z.infer<typeof registerRequestSchema>
