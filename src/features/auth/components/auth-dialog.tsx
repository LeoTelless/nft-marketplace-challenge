import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { HomeHero } from '@/features/catalog/home-sections'
import { FormAlert, PasswordField, TextField } from '@/shared/flow-ui/fields'
import { applyApiErrors } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import type { AuthSearch } from '@/shared/session/redirect'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import facebookUrl from '../assets/facebook.svg'
import googleUrl from '../assets/google.svg'
import { loginFormSchema, registerFormSchema, useLogin, useRegister, type LoginFormValues, type RegisterFormValues } from '../use-auth'

type Mode = 'login' | 'register'

/**
 * Login and sign-up: the modal of the desktop frames (500px card over the home hero, 10px
 * orange bottom bar, "Entrar | Criar conta" switch) and the full-screen screens of the mobile
 * frames. They are routes (`/login`, `/register`), so direct access and refresh work; the
 * dialog traps focus, closes with Esc/backdrop/X and returns the user to where they were.
 */
export function AuthScreen({ mode, search }: { mode: Mode; search: AuthSearch }) {
  const router = useRouter()
  const navigate = useNavigate()
  // The element that opened the dialog (e.g. the header "Entrar"), focused again when it closes.
  const [trigger] = useState(() => (typeof document === 'undefined' ? null : (document.activeElement as HTMLElement | null)))
  const close = () => {
    // Back to where the user was; after an expiry the previous page is private (the guard would
    // bounce back here), so go home instead.
    if (search.reason !== 'expired' && router.history.canGoBack()) router.history.back()
    else void navigate({ to: '/', replace: true })
  }

  return (
    <>
      <div aria-hidden="true" inert className="pointer-events-none max-md:hidden">
        <div className="pt-6 md:pt-8">
          <HomeHero />
        </div>
      </div>
      <Dialog open onOpenChange={(open) => (open ? undefined : close())}>
        <DialogContent
          aria-describedby={`${mode}-description`}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            // Only when focus would be lost (on <body>); never steal it from where it already went.
            const active = document.activeElement
            if (active && active !== document.body && active.isConnected) return
            const target = trigger?.isConnected && trigger !== document.body ? trigger : document.getElementById('conteudo')
            target?.focus()
          }}
          className={cn(
            // Rows keep their own height (no stretching to fill the box): the frames stack the
            // blocks with fixed gaps and leave the remaining space at the bottom.
            'content-start gap-0 overflow-y-auto p-0 shadow-none!',
            // Mobile (and 640–767px, where the base `sm:max-w-lg` would pin a 512px box to the
            // left): full screen, as the mobile frames.
            'max-md:inset-0 max-md:top-0 max-md:left-0 max-md:h-dvh max-md:max-w-none max-md:sm:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 max-md:bg-ink max-md:px-7 max-md:pt-20 max-md:pb-6',
            // Desktop: the 500px card with the orange bottom bar (login 500x600, sign-up 500x656
            // with an 8px radius); the blocks start at the top and the space left stays below.
            'md:max-h-[calc(100dvh-2rem)] md:max-w-[500px] md:border-0 md:border-b-[10px] md:border-b-brand md:pt-12 md:pb-14',
            mode === 'login' ? 'md:min-h-[600px] md:rounded-none' : 'md:min-h-[656px] md:rounded-[8px]',
          )}
        >
          <p aria-hidden="true" className="mb-10 grid h-[136px] place-content-center text-[32px] leading-[42px] font-bold tracking-[0.1em] md:hidden">
            KURIO
          </p>
          <div className="flex flex-col items-center gap-10 md:px-12">
            <DialogTitle className={cn('leading-4 font-bold md:sr-only', mode === 'login' ? 'text-xl' : 'text-lg')}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</DialogTitle>
            <nav aria-label="Acesso à conta" className="flex items-center gap-2 text-xl leading-4 font-medium max-md:hidden">
              <Link
                to="/login"
                search={search}
                replace
                aria-current={mode === 'login' ? 'page' : undefined}
                className={cn(mode === 'login' ? 'text-brand-accent' : 'text-foreground hover:text-brand-accent')}
              >
                Entrar
              </Link>
              <span aria-hidden="true" className="h-5 w-px bg-coral" />
              <Link
                to="/register"
                search={search}
                replace
                aria-current={mode === 'register' ? 'page' : undefined}
                className={cn(mode === 'register' ? 'text-brand-accent' : 'text-foreground hover:text-brand-accent')}
              >
                Criar conta
              </Link>
            </nav>
            <DialogDescription id={`${mode}-description`} className="text-center text-[13px] leading-4 text-foreground max-md:sr-only">
              {mode === 'login'
                ? 'Entre para gerenciar sua carteira, coleção e perfil de criador.'
                : 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.'}
            </DialogDescription>
          </div>
          {search.reason ? (
            <p role="status" className="mx-auto mt-6 w-full max-w-[340px] rounded-sm border border-amber/60 bg-amber/10 px-3 py-2 text-center text-sm max-md:max-w-none">
              {search.reason === 'expired' ? 'Sua sessão expirou. Entre novamente para continuar de onde parou.' : 'Entre na sua conta para continuar.'}
            </p>
          ) : null}
          {mode === 'login' ? <LoginForm redirectTo={search.redirect} /> : <RegisterForm redirectTo={search.redirect} />}
          <SocialLogin mode={mode} />
          {/* Frame: the whole line in #CFB28C; the link is told apart by the underline (not by color only). */}
          <p className="mt-10 text-center text-[15px] leading-5 text-text-secondary md:hidden">
            {mode === 'login' ? (
              <>
                Novo na Kurio?{' '}
                <Link to="/register" search={search} replace className="underline underline-offset-4 hover:text-brand-accent">
                  Crie uma conta
                </Link>
              </>
            ) : (
              <>
                Já tem uma conta?{' '}
                <Link to="/login" search={search} replace className="underline underline-offset-4 hover:text-brand-accent">
                  Entre
                </Link>
              </>
            )}
          </p>
        </DialogContent>
      </Dialog>
    </>
  )
}

function FormShell({ label, onSubmit, children }: { label: string; onSubmit: () => void; children: ReactNode }) {
  return (
    <form
      noValidate
      aria-label={label}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="mx-auto mt-10 flex w-full max-w-[340px] flex-col gap-3 max-md:max-w-none md:mt-6"
    >
      {children}
    </form>
  )
}

/** 40px below the last field on mobile and 24px in the modal (the form gap adds 12px). */
const submitClass = 'mt-7 h-[60px] w-full rounded-[10px] text-base font-bold md:mt-3 md:h-[45px] md:rounded-[5px]'

function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const login = useLogin({ redirectTo })
  const form = useForm<LoginFormValues>({ resolver: zodResolver(loginFormSchema), defaultValues: { email: '', password: '' } })
  const { errors, isSubmitting } = form.formState
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
    } catch (error) {
      // A wrong e-mail/password has no field error: the submit button was disabled while sending
      // (focus would drop to <body>), so focus goes back to the first field; the alert is announced.
      if (!applyApiErrors(error, form.setError, ['email', 'password'])) form.setFocus('email')
    }
  })
  return (
    <FormShell label="Entrar" onSubmit={() => void onSubmit()}>
      <TextField label="E-mail" hideLabel tall type="email" autoComplete="email" placeholder="contato@email.com" required error={errors.email?.message} {...form.register('email')} />
      <PasswordField label="Senha" hideLabel tall autoComplete="current-password" placeholder="Senha" required error={errors.password?.message} {...form.register('password')} />
      <p className="text-right text-sm leading-4 text-brand-accent/70">
        <span aria-disabled="true" title="Recuperação de senha indisponível nesta demonstração">
          Esqueceu a senha? <span className="text-xs text-text-muted">(em breve)</span>
        </span>
      </p>
      <FormAlert message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={submitClass}>
        {isSubmitting ? 'Entrando…' : 'Entrar'}
      </Button>
    </FormShell>
  )
}

function RegisterForm({ redirectTo }: { redirectTo?: string }) {
  const register = useRegister({ redirectTo })
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState
  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await register.mutateAsync(values)
    } catch (error) {
      if (!applyApiErrors(error, form.setError, ['name', 'email', 'password', 'confirmPassword'])) form.setFocus('name')
    }
  })
  return (
    <FormShell label="Criar conta" onSubmit={() => void onSubmit()}>
      <TextField label="Nome de usuário" hideLabel tall autoComplete="name" placeholder="Nome de usuário" required error={errors.name?.message} {...form.register('name')} />
      <TextField label="E-mail" hideLabel tall type="email" autoComplete="email" placeholder="Digite seu e-mail" required error={errors.email?.message} {...form.register('email')} />
      <PasswordField
        label="Senha"
        hideLabel
        tall
        autoComplete="new-password"
        placeholder="Senha"
        required
        hint="Mínimo de 8 caracteres, com letras e números."
        hintMode="on-error"
        error={errors.password?.message}
        {...form.register('password')}
      />
      <PasswordField label="Confirmar senha" hideLabel tall autoComplete="new-password" placeholder="Confirmar senha" required error={errors.confirmPassword?.message} {...form.register('confirmPassword')} />
      <FormAlert message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className={submitClass}>
        {isSubmitting ? 'Criando conta…' : 'Criar conta'}
      </Button>
    </FormShell>
  )
}

/** Social login is outside the challenge scope: shown as in the layout, disabled and marked. */
function SocialLogin({ mode }: { mode: Mode }) {
  const button =
    'flex h-10 w-full cursor-not-allowed items-center justify-center gap-3 rounded-[5px] border border-line text-[13px] font-medium text-text-secondary opacity-70'
  // Frames: divider → buttons 12px and 16px between the buttons on mobile; in the modal 12/12
  // (login) and 16/16 (sign-up).
  return (
    <div className={cn('mt-10 flex flex-col gap-3 md:mt-6', mode === 'register' && 'md:gap-4')}>
      <div className="flex items-center gap-2.5 text-[13px] leading-4 md:gap-3">
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
        Ou continue com
        <span aria-hidden="true" className="h-px flex-1 bg-line" />
      </div>
      <div className={cn('mx-auto flex w-full max-w-[340px] flex-col gap-4 max-md:max-w-none', mode === 'login' && 'md:gap-3')}>
        <button type="button" disabled className={button}>
          <img src={googleUrl} alt="" width={20} height={20} /> Continuar com Google <span className="text-xs text-text-muted">(em breve)</span>
        </button>
        <button type="button" disabled className={button}>
          <img src={facebookUrl} alt="" width={20} height={20} /> Continuar com Facebook <span className="text-xs text-text-muted">(em breve)</span>
        </button>
      </div>
    </div>
  )
}
