import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/components/auth-dialog'
import { redirectIfAuthenticated } from '@/features/auth/guard'
import { authSearchSchema, safeRedirect } from '@/shared/session/redirect'

/** Entrar: modal over the home hero (desktop) / full screen (mobile); works on direct access. */
export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  beforeLoad: ({ context, search }) => redirectIfAuthenticated(context.queryClient, safeRedirect(search.redirect)),
  head: () => ({ meta: [{ title: 'Entrar | KURIO' }] }),
  component: function LoginPage() {
    return <AuthScreen mode="login" search={Route.useSearch()} />
  },
})
