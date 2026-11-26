import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { ChevronLeftIcon } from '@/shared/ui/icons'
import type { Crumb } from './crumbs'

/** "Início / Mercado / …" trail of the desktop frames (hidden on mobile, which has a screen header). */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={cn('max-md:hidden', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[15px] leading-4 font-bold text-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <li key={item.label} className="flex items-center gap-1.5">
              {last || !item.to ? (
                <span aria-current={last ? 'page' : undefined}>{item.label}</span>
              ) : (
                <Link to={item.to} hash={item.hash} className="hover:text-brand-accent">
                  {item.label}
                </Link>
              )}
              {last ? null : <span aria-hidden="true">/</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * Mobile screen header (Figma: 35px round back button with the #B39463 Iconly arrow + 20px
 * title, 44px tall). The title is the page `h1` on mobile (desktop pages render their own
 * heading and hide this one); `titleAs="p"` when the screen state already has its own `h1`
 * (empty cart). `align="start"` puts the title 24px after the button, as in the payment frame.
 */
export function MobileScreenHeader({
  title,
  fallback = '/',
  align = 'center',
  titleAs: Title = 'h1',
  className,
}: {
  title: string
  fallback?: '/' | '/cart'
  align?: 'center' | 'start'
  titleAs?: 'h1' | 'p'
  className?: string
}) {
  const router = useRouter()
  const navigate = useNavigate()
  return (
    // 44px block as in the frames: the 35px row (button and title share its center) + 9px.
    <div className={cn('relative mb-[9px] flex min-h-[35px] items-center md:hidden', align === 'center' ? 'justify-center' : 'justify-start', className)}>
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (router.history.canGoBack() ? router.history.back() : void navigate({ to: fallback }))}
        className="absolute top-0 left-0 grid size-[35px] cursor-pointer place-content-center rounded-full border border-line bg-surface-raised text-text-muted hover:border-brand hover:text-brand-accent"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <Title
        className={cn(
          'text-lg leading-4 font-bold text-foreground min-[400px]:text-xl',
          align === 'center' ? 'px-12 text-center' : 'pr-2 pl-[59px] text-left',
        )}
      >
        {title}
      </Title>
    </div>
  )
}

/** Section title with the thin orange rule of the frames ("Resumo da carteira", "NFTs"…). */
export function SectionTitle({ id, children, className, as: Tag = 'h2' }: { id?: string; children: ReactNode; className?: string; as?: 'h1' | 'h2' }) {
  return (
    <Tag id={id} className={cn('border-b border-brand/30 pb-3 text-lg leading-4 font-bold text-foreground', className)}>
      {children}
    </Tag>
  )
}
