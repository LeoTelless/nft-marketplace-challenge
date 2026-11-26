import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'
import { Compass, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'

/** Shared layout of full-page states (404, unexpected error, missing NFT…). */
export function StatusPage({
  icon: Icon,
  code,
  title,
  children,
  actions,
  tone = 'default',
  testId,
}: {
  icon: LucideIcon
  code?: string
  title: string
  children: ReactNode
  actions: ReactNode
  tone?: 'default' | 'error'
  testId?: string
}) {
  return (
    <div data-testid={testId} className="container-page flex flex-col items-center py-16 text-center md:py-24">
      <span
        aria-hidden="true"
        className={cn(
          'grid size-[74px] place-content-center rounded-full',
          tone === 'error' ? 'bg-coral/15 text-coral' : 'bg-brand text-ink',
        )}
      >
        <Icon className="size-8" />
      </span>
      {code ? <p className="mt-6 text-sm leading-4 font-medium tracking-[0.1em] text-brand-accent">{code}</p> : null}
      <h1 className="mt-3 text-2xl leading-9 font-bold text-foreground md:text-[28px]">{title}</h1>
      <div className="mt-3 max-w-md text-sm leading-6 text-text-secondary">{children}</div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">{actions}</div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <StatusPage
      icon={Compass}
      code="ERRO 404"
      title="Página não encontrada"
      testId="not-found"
      actions={
        <Link to="/" className={buttonVariants()}>
          Voltar ao marketplace
        </Link>
      }
    >
      <p>O endereço pode ter mudado ou não existe mais. Explore o catálogo para encontrar novos NFTs.</p>
    </StatusPage>
  )
}

/**
 * Root error boundary: unexpected render/loader errors. "Tentar novamente" resets the query
 * error boundary and re-runs the route, without a full page reload.
 */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const queryErrorBoundary = useQueryErrorResetBoundary()
  useEffect(() => {
    queryErrorBoundary.reset()
  }, [queryErrorBoundary])

  return (
    <StatusPage
      icon={TriangleAlert}
      tone="error"
      title="Algo deu errado"
      testId="route-error"
      actions={
        <>
          <Button
            onClick={() => {
              reset()
              void router.invalidate()
            }}
          >
            Tentar novamente
          </Button>
          <Link to="/" className={buttonVariants({ variant: 'outline' })}>
            Ir para o início
          </Link>
        </>
      }
    >
      <p>Não foi possível exibir esta tela. Tente novamente; se o problema continuar, volte ao início.</p>
      {import.meta.env.DEV && error instanceof Error ? (
        <pre className="mt-4 overflow-auto text-left text-xs text-coral">{error.message}</pre>
      ) : null}
    </StatusPage>
  )
}
