import { Link } from '@tanstack/react-router'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { useLogout } from '@/features/auth/use-auth'
import { cn } from '@/shared/lib/utils'
import { ActivityIcon, DangerTriangleIcon, DownloadIcon, HeartIcon, LocationIcon, LogoutIcon, ShoppingIcon, UserIcon } from '@/shared/ui/icons'

type AccountPath = '/account/profile' | '/account/wallets' | '/orders' | '/account/favorites'
type Icon = ComponentType<SVGProps<SVGSVGElement>>

/** Iconly glyphs of the frame menu, at their frame sizes (16–20px; the text follows 12px after). */
const LINKS: Array<{ to: AccountPath; label: string; icon: Icon; size: string }> = [
  { to: '/account/profile', label: 'Dados do perfil', icon: UserIcon, size: 'size-[18px]' },
  { to: '/account/wallets', label: 'Carteiras', icon: LocationIcon, size: 'size-5' },
  { to: '/orders', label: 'Atividade', icon: ShoppingIcon, size: 'size-[18px]' },
  { to: '/account/favorites', label: 'Lista de interesse', icon: HeartIcon, size: 'size-4' },
]

/** Items of the Figma menu without a feature in scope: visible, disabled, marked "em breve". */
const SOON: Array<{ label: string; icon: Icon }> = [
  { label: 'Ofertas', icon: ActivityIcon },
  { label: 'Arquivos baixados', icon: DownloadIcon },
  { label: 'Suporte', icon: DangerTriangleIcon },
]

const item = 'flex h-[45px] shrink-0 items-center gap-3 px-4 text-[15px] leading-[15px] text-brand-accent whitespace-nowrap'

/**
 * "Meu perfil" area (Perfil, Carteiras, Atividade, Lista de interesse): the 310px side menu of
 * the desktop frames; below `lg` the menu becomes a horizontal, scrollable tab row (derived
 * mobile layout, see DECISOES).
 */
export function AccountLayout({ children }: { children: ReactNode }) {
  const logout = useLogout()
  return (
    // min-h: the footer starts below the fold while data loads, so skeleton → content never shifts it (CLS).
    <div className="container-page flex min-h-dvh flex-col gap-6 pt-4 md:pt-8 lg:flex-row lg:items-start lg:gap-7">
      <aside className="bg-surface lg:w-[310px] lg:shrink-0 lg:py-2 max-lg:-mx-6 max-lg:md:-mx-10">
        <p className="hidden p-2.5 text-lg leading-4 font-bold lg:block" aria-hidden="true">
          Meu perfil
        </p>
        <nav aria-label="Meu perfil">
          <ul className="flex overflow-x-auto scrollbar-none lg:flex-col">
            {LINKS.map(({ to, label, icon: Icon, size }) => (
              <li key={to}>
                {/* Icons 16px from the edge (6px border + 10px); the current item's icon is #D28A4C. */}
                <Link
                  to={to}
                  className={cn(
                    item,
                    'group border-transparent hover:bg-surface-raised max-lg:border-b-2 lg:border-l-[6px] lg:pl-2.5',
                    to === '/account/profile' && 'lg:gap-4',
                  )}
                  activeProps={{ className: 'border-brand! bg-surface-raised lg:bg-transparent', 'aria-current': 'page' }}
                >
                  <Icon className={cn(size, 'shrink-0 text-text-muted group-aria-[current=page]:text-brand')} />
                  {label}
                </Link>
              </li>
            ))}
            {SOON.map(({ label, icon: Icon }) => (
              <li key={label} className="max-lg:hidden">
                <span aria-disabled="true" className={cn(item, 'cursor-not-allowed opacity-60')}>
                  <Icon className="size-[18px] shrink-0 text-text-muted" />
                  {label} <span className="text-xs text-text-muted">(em breve)</span>
                </span>
              </li>
            ))}
            <li className="lg:mt-0 lg:border-t lg:border-brand/30">
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className={cn(item, 'w-full cursor-pointer gap-2 font-bold hover:bg-surface-raised disabled:opacity-60 lg:h-10')}
              >
                <LogoutIcon className="size-5 shrink-0 text-brand" />
                {logout.isPending ? 'Saindo…' : 'Sair'}
              </button>
            </li>
          </ul>
        </nav>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/** Page heading of the account screens (16px bold in the frames). */
export function AccountHeading({
  title,
  description,
  action,
  id,
  as: Tag = 'h1',
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
  id?: string
  as?: 'h1' | 'h2'
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex flex-col gap-2">
        <Tag id={id} className={cn('text-lg leading-5 font-bold md:leading-4', Tag === 'h2' ? 'md:text-[17px]' : 'md:text-base')}>
          {title}
        </Tag>
        {description ? <p className="text-[15px] leading-5 text-text-secondary md:text-sm md:leading-[15px]">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
