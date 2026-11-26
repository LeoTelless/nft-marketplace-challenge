import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireSession } from '@/features/auth/guard'

/**
 * Private area (checkout, orders, profile, wallets, favorites). `beforeLoad` validates the
 * session (`GET /session`, cached per token) and otherwise redirects to `/login` with the
 * requested location, so the flow resumes after authenticating.
 * Expiry *while* on a private screen is handled by the session provider (same redirect).
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => requireSession(context.queryClient, location),
  component: Outlet,
})
