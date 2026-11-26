import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { loginRequestSchema, registerRequestSchema, type Session } from '@/contracts'
import { notify } from '@/shared/feedback/notifications'
import { safeRedirect } from '@/shared/session/redirect'
import { sessionStore } from '@/shared/session/session-store'
import { authApi } from './api'
import { endSession, startSession } from './session'

export const loginFormSchema = loginRequestSchema.pick({ email: true }).extend({
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginFormValues = z.infer<typeof loginFormSchema>

export const registerFormSchema = registerRequestSchema
  .pick({ name: true, email: true, password: true })
  .extend({ confirmPassword: z.string().min(1, 'Confirme a senha') })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type RegisterFormValues = z.infer<typeof registerFormSchema>

function useCompleteAuth(redirectTo: string | undefined) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return async (session: Session) => {
    startSession(queryClient, session)
    await navigate({ href: safeRedirect(redirectTo), replace: true })
  }
}

/**
 * Login. The visitor cart id goes along so the server merges the visitor cart into the
 * account cart; on success every cached private data is dropped (user switch safe) and
 * the user is sent to `redirectTo` (validated against open redirects).
 * Errors (`ApiError`) are left to the form: map them with `applyApiErrors`.
 */
export function useLogin(options: { redirectTo?: string } = {}) {
  const complete = useCompleteAuth(options.redirectTo)
  return useMutation({
    mutationKey: ['auth', 'login'],
    mutationFn: (values: LoginFormValues) =>
      authApi.login({ ...values, guestCartId: sessionStore.getGuestCartId() }),
    onSuccess: complete,
  })
}

export function useRegister(options: { redirectTo?: string } = {}) {
  const complete = useCompleteAuth(options.redirectTo)
  return useMutation({
    mutationKey: ['auth', 'register'],
    mutationFn: ({ confirmPassword: _confirm, ...values }: RegisterFormValues) =>
      authApi.register({ ...values, guestCartId: sessionStore.getGuestCartId() }),
    onSuccess: async (session) => {
      await complete(session)
      notify({ tone: 'success', title: `Conta criada. Boas-vindas, ${session.user.name}!` })
    },
  })
}

/**
 * Logout. The server session is revoked best effort; locally the token, private cache,
 * per-user storage and socket (recreated as visitor by the realtime provider) always go.
 */
export function useLogout() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return useMutation({
    mutationKey: ['auth', 'logout'],
    mutationFn: () => authApi.logout().catch(() => undefined),
    onSettled: async () => {
      endSession(queryClient)
      const onPrivateRoute = router.state.matches.some((match) => match.routeId.startsWith('/_authenticated'))
      if (onPrivateRoute) await router.navigate({ to: '/', replace: true })
      notify({ tone: 'info', title: 'Você saiu da sua conta.' })
    },
  })
}
