import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { FormError, TextField } from '@/features/auth/form-field'
import { redirectIfAuthenticated } from '@/features/auth/guard'
import { loginFormSchema, useLogin, type LoginFormValues } from '@/features/auth/use-auth'
import { applyApiErrors } from '@/shared/lib/form-errors'
import { authSearchSchema, safeRedirect } from '@/shared/session/redirect'
import { Button } from '@/shared/ui/button'

/** Provisional login screen (flow skeleton; the styled modal comes in stage 2). */
export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  beforeLoad: ({ context, search }) => redirectIfAuthenticated(context.queryClient, safeRedirect(search.redirect)),
  head: () => ({ meta: [{ title: 'Entrar | KURIO' }] }),
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const login = useLogin({ redirectTo: search.redirect })
  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
    } catch (error) {
      applyApiErrors(error, form.setError, ['email', 'password'])
    }
  })

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      {search.reason === 'expired' ? (
        <p role="status">Sua sessão expirou. Entre novamente para continuar de onde parou.</p>
      ) : search.reason === 'required' ? (
        <p role="status">Entre na sua conta para continuar.</p>
      ) : null}
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Entrar">
        <TextField label="E-mail" type="email" autoComplete="email" required error={errors.email?.message} {...form.register('email')} />
        <TextField label="Senha" type="password" autoComplete="current-password" required error={errors.password?.message} {...form.register('password')} />
        <FormError message={errors.root?.server?.message} />
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined}>
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <p className="text-sm">
        Não tem conta?{' '}
        <Link to="/register" search={{ redirect: search.redirect }} className="underline">
          Criar conta
        </Link>
      </p>
    </div>
  )
}
