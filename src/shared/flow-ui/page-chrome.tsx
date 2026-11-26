import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
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
 * Mobile screen header (Figma: round back button + centered 20px title). The title is the
 * page `h1` on mobile; desktop pages render their own heading and hide this one.
 */
export function MobileScreenHeader({ title, fallback = '/', className }: { title: string; fallback?: '/' | '/cart'; className?: string }) {
  const router = useRouter()
  const navigate = useNavigate()
  return (
    <div className={cn('relative flex min-h-11 items-center justify-center md:hidden', className)}>
      <button
        type="button"
        aria-label="Voltar"
        onClick={() => (router.history.canGoBack() ? router.history.back() : void navigate({ to: fallback }))}
        className="absolute left-0 grid size-[35px] cursor-pointer place-content-center rounded-full border border-line bg-surface-raised text-brand-accent hover:border-brand"
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>
      <h1 className="px-12 text-center text-xl leading-6 font-bold text-foreground">{title}</h1>
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
