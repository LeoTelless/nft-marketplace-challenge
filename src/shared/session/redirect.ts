import { z } from 'zod'

/**
 * `redirect` search param of `/login` and `/register`: where to go after authenticating.
 * Only same-origin, absolute paths are accepted (no `//host`, no scheme), so the param can
 * never be used as an open redirect.
 */
export function safeRedirect(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string') return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  try {
    const url = new URL(value, 'http://internal.invalid')
    if (url.origin !== 'http://internal.invalid') return fallback
    // Never bounce back to the auth screens themselves.
    if (url.pathname === '/login' || url.pathname === '/register') return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

export const authSearchSchema = z.object({
  redirect: z.string().optional().catch(undefined),
  /** Why the user was sent to login (shown as a notice). */
  reason: z.enum(['expired', 'required']).optional().catch(undefined),
})
export type AuthSearch = z.infer<typeof authSearchSchema>
