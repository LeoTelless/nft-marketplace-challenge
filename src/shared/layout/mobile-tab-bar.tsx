import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { HeartIcon, HomeIcon, ShopIcon, UserIcon } from '@/shared/ui/icons'
import { MobileMenu } from './site-header'

/**
 * Bottom tab bar of the mobile frame (< 768px): Início, Favoritos, Carrinho (with counter) and
 * Conta. The central "scan" button of the layout was left out: scanning is not in scope
 * (DECISOES.md). Favorites is a private page: visitors are sent to login by its guard.
 * "Conta" opens the navigation/account drawer (login or profile, wallets, logout), since the
 * Início and Detalhe frames have no header on mobile.
 */
export function MobileTabBar({
  cartCount,
  account,
}: {
  cartCount: number
  /** Account block of the drawer (`LoginButton` or `UserMenu`). */
  account: ReactNode
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const item = (active: boolean) =>
    cn(
      'relative flex h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-3',
      active ? 'text-brand-accent' : 'text-text-secondary hover:text-foreground',
    )
  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-40 rounded-t-[40px] bg-surface px-6 pt-2 pb-[max(env(safe-area-inset-bottom),12px)] shadow-bar md:hidden"
    >
      <ul className="flex items-center">
        <li className="flex flex-1">
          <Link to="/" aria-current={pathname === '/' ? 'page' : undefined} className={item(pathname === '/')}>
            <HomeIcon className="size-5" />
            Início
          </Link>
        </li>
        <li className="flex flex-1">
          <Link
            to="/account/favorites"
            aria-current={pathname === '/account/favorites' ? 'page' : undefined}
            className={item(pathname === '/account/favorites')}
          >
            <HeartIcon className="size-5" />
            Favoritos
          </Link>
        </li>
        <li className="flex flex-1">
          <Link
            to="/cart"
            aria-label={cartCount ? `Carrinho, ${cartCount} ${cartCount === 1 ? 'item' : 'itens'}` : 'Carrinho'}
            aria-current={pathname === '/cart' ? 'page' : undefined}
            className={item(pathname === '/cart')}
          >
            <span className="relative">
              <ShopIcon className="size-5" />
              {cartCount > 0 ? (
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-content-center rounded-full bg-brand px-1 text-[10px] font-medium text-ink ring-2 ring-surface"
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              ) : null}
            </span>
            Carrinho
          </Link>
        </li>
        <li className="flex flex-1">
          <MobileMenu
            account={account}
            trigger={
              <button
                type="button"
                className={item(pathname.startsWith('/account') || pathname === '/login')}
                data-testid="tab-account"
              >
                <UserIcon className="size-5" />
                Conta
              </button>
            }
          />
        </li>
      </ul>
    </nav>
  )
}
