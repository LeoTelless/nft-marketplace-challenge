import { Link } from '@tanstack/react-router'
import { Download, Heart, LogOut, MapPin, ShoppingCart, Tag, TriangleAlert, UserRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLogout } from '@/features/auth/use-auth'
import { cn } from '@/shared/lib/utils'

type AccountPath = '/account/profile' | '/account/wallets' | '/orders' | '/account/favorites'

const LINKS: Array<{ to: AccountPath; label: string; icon: LucideIcon }> = [
  { to: '/account/profile', label: 'Dados do perfil', icon: UserRound },
  { to: '/account/wallets', label: 'Carteiras', icon: MapPin },
  { to: '/orders', label: 'Atividade', icon: ShoppingCart },
  { to: '/account/favorites', label: 'Lista de interesse', icon: Heart },
]

/** Items of the Figma menu without a feature in scope: visible, disabled, marked "em breve". */
const SOON: Array<{ label: string; icon: LucideIcon }> = [
  { label: 'Ofertas', icon: Tag },
  { label: 'Arquivos baixados', icon: Download },
  { label: 'Suporte', icon: TriangleAlert },
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
    <div className="container-page flex flex-col gap-6 pt-4 md:pt-8 lg:flex-row lg:items-start lg:gap-7">
      <aside className="bg-surface lg:w-[310px] lg:shrink-0 lg:py-2 max-lg:-mx-6 max-lg:md:-mx-10">
        <p className="hidden p-2.5 text-lg leading-4 font-bold lg:block" aria-hidden="true">
          Meu perfil
        </p>
        <nav aria-label="Meu perfil">
          <ul className="flex overflow-x-auto scrollbar-none lg:flex-col">
            {LINKS.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(item, 'border-transparent hover:bg-surface-raised max-lg:border-b-2 lg:border-l-[6px] lg:pl-2.5')}
                  activeProps={{ className: 'border-brand! bg-surface-raised lg:bg-transparent', 'aria-current': 'page' }}
                >
                  <Icon className="size-[18px] text-text-muted" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
            {SOON.map(({ label, icon: Icon }) => (
              <li key={label} className="max-lg:hidden">
                <span aria-disabled="true" className={cn(item, 'cursor-not-allowed pl-4 opacity-60 lg:pl-[22px]')}>
                  <Icon className="size-[18px] text-text-muted" aria-hidden="true" />
                  {label} <span className="text-xs text-text-muted">(em breve)</span>
                </span>
              </li>
            ))}
            <li className="lg:mt-0 lg:border-t lg:border-brand/30">
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className={cn(item, 'w-full cursor-pointer font-bold hover:bg-surface-raised disabled:opacity-60 lg:h-10 lg:pl-[22px]')}
              >
                <LogOut className="size-5" aria-hidden="true" />
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
        <Tag id={id} className="text-lg leading-5 font-bold md:text-base md:leading-4">
          {title}
        </Tag>
        {description ? <p className="text-[15px] leading-5 text-text-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
