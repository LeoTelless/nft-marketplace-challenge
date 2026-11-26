import type { QueryClient } from '@tanstack/react-query'
import type { CSSProperties } from 'react'
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'
import { SessionProvider } from '@/features/auth/session-provider'
import { DemoPanel } from '@/features/demo/demo-panel'
import { useSession } from '@/features/auth/session'
import { useLogout } from '@/features/auth/use-auth'
import { useCartCount } from '@/features/cart/use-cart'
import { cn } from '@/shared/lib/utils'
import { CartButton } from '@/shared/layout/cart-button'
import { MobileTabBar } from '@/shared/layout/mobile-tab-bar'
import { SiteFooter } from '@/shared/layout/site-footer'
import { SiteHeader } from '@/shared/layout/site-header'
import { NotFoundPage, RouteErrorPage } from '@/shared/layout/status-page'
import { LoginButton, UserMenu } from '@/shared/layout/user-menu'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

/** Screens with their own bottom action bar on mobile (the tab bar would cover it). */
function useHidesTabBar() {
  return useRouterState({
    select: (state) =>
      state.matches.some((match) => match.routeId === '/nft/$nftId' || match.routeId === '/_authenticated/checkout'),
  })
}

/** Screens whose mobile frame has no header (the tab bar gives access to menu and account). */
function useHidesMobileHeader() {
  return useRouterState({
    select: (state) => state.matches.some((match) => match.routeId === '/' || match.routeId === '/nft/$nftId'),
  })
}

function AccountSlot({ variant }: { variant: 'header' | 'menu' }) {
  const { user, status } = useSession()
  const logout = useLogout()
  if (status === 'loading') {
    // Reserve the button box while the stored session is validated (no layout shift).
    return (
      <span
        aria-hidden="true"
        className={cn('block h-[35px] rounded-sm bg-surface', variant === 'header' ? 'w-[100px]' : 'w-full')}
      />
    )
  }
  if (!user) return <LoginButton className={variant === 'menu' ? 'w-full' : undefined} />
  return <UserMenu name={user.name} email={user.email} onLogout={() => logout.mutate()} loggingOut={logout.isPending} />
}

function RootLayout() {
  const cartCount = useCartCount()
  const hideTabBar = useHidesTabBar()
  const hideMobileHeader = useHidesMobileHeader()

  return (
    <SessionProvider>
      <a
        href="#conteudo"
        className="fixed top-2 left-2 z-[60] -translate-y-20 rounded-sm bg-brand px-4 py-2 text-sm font-bold text-ink transition-transform focus:translate-y-0"
      >
        Pular para o conteúdo
      </a>
      <div className="flex min-h-dvh flex-col">
        <SiteHeader
          cart={<CartButton count={cartCount} />}
          account={<AccountSlot variant="header" />}
          mobileAccount={<AccountSlot variant="menu" />}
          hideBelowMd={hideMobileHeader}
        />
        <main id="conteudo" tabIndex={-1} className={cn('flex-1 outline-none', !hideTabBar && 'max-md:pb-6')}>
          <Outlet />
        </main>
        <div className={hideTabBar ? 'max-md:pb-44' : 'max-md:pb-24'}>
          <SiteFooter />
        </div>
      </div>
      <div className="contents" style={{ '--mobile-bar-offset': hideTabBar ? '184px' : '96px' } as CSSProperties}>
        <DemoPanel />
      </div>
      {hideTabBar ? null : <MobileTabBar cartCount={cartCount} account={<AccountSlot variant="menu" />} />}
    </SessionProvider>
  )
}
