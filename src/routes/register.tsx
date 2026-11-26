import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/components/auth-dialog'
import { redirectIfAuthenticated } from '@/features/auth/guard'
import { authSearchSchema, safeRedirect } from '@/shared/session/redirect'

/** Criar conta: modal over the home hero (desktop) / full screen (mobile); works on direct access. */
export const Route = createFileRoute('/register')({
  validateSearch: authSearchSchema,
  beforeLoad: ({ context, search }) => redirectIfAuthenticated(context.queryClient, safeRedirect(search.redirect)),
  head: () => ({ meta: [{ title: 'Criar conta | KURIO' }] }),
  component: function RegisterPage() {
    return <AuthScreen mode="register" search={Route.useSearch()} />
  },
})
