import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { FormError, TextField } from '@/features/auth/form-field'
import { redirectIfAuthenticated } from '@/features/auth/guard'
import { registerFormSchema, useRegister, type RegisterFormValues } from '@/features/auth/use-auth'
import { applyApiErrors } from '@/shared/lib/form-errors'
import { authSearchSchema, safeRedirect } from '@/shared/session/redirect'
import { Button } from '@/shared/ui/button'

/** Provisional sign-up screen (flow skeleton; the styled modal comes in stage 2). */
export const Route = createFileRoute('/register')({
  validateSearch: authSearchSchema,
  beforeLoad: ({ context, search }) => redirectIfAuthenticated(context.queryClient, safeRedirect(search.redirect)),
  head: () => ({ meta: [{ title: 'Criar conta | KURIO' }] }),
  component: RegisterPage,
})

function RegisterPage() {
  const search = Route.useSearch()
  const register = useRegister({ redirectTo: search.redirect })
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values)
    } catch (error) {
      applyApiErrors(error, form.setError, ['name', 'email', 'password', 'confirmPassword'])
    }
  })

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Criar conta">
        <TextField label="Nome de usuário" autoComplete="name" required error={errors.name?.message} {...form.register('name')} />
        <TextField label="E-mail" type="email" autoComplete="email" required error={errors.email?.message} {...form.register('email')} />
        <TextField
          label="Senha"
          type="password"
          autoComplete="new-password"
          required
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.password?.message}
          {...form.register('password')}
        />
        <TextField label="Confirmar senha" type="password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...form.register('confirmPassword')} />
        <FormError message={errors.root?.server?.message} />
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined}>
          {isSubmitting ? 'Criando conta…' : 'Criar conta'}
        </Button>
      </form>
      <p className="text-sm">
        Já tem conta?{' '}
        <Link to="/login" search={{ redirect: search.redirect }} className="underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
