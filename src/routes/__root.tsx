import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Outlet, useRouterState } from '@tanstack/react-router'
import { SessionProvider } from '@/features/auth/session-provider'
import { DemoPanel } from '@/features/demo/demo-panel'
import { useSession } from '@/features/auth/session'
import { useLogout } from '@/features/auth/use-auth'
import { useCartCount } from '@/features/cart/use-cart'
import { RotateCw } from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
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
  // Default title; routes override it with their own `head` (rendered by <HeadContent />).
  head: () => ({ meta: [{ title: 'KURIO · Marketplace de NFTs' }] }),
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: RouteErrorPage,
})

/** Screens with their own bottom action bar on mobile, or whose mobile frame has no tab bar. */
const NO_TAB_BAR = new Set(['/nft/$nftId', '/_authenticated/checkout', '/cart'])
const ACTION_BAR = new Set(['/nft/$nftId', '/_authenticated/checkout'])
function useHidesTabBar() {
  return useRouterState({ select: (state) => state.matches.some((match) => NO_TAB_BAR.has(match.routeId)) })
}
/** Fixed purchase bar at the bottom on mobile (detail, checkout). */
function useHasActionBar() {
  return useRouterState({ select: (state) => state.matches.some((match) => ACTION_BAR.has(match.routeId)) })
}

/** Screens whose mobile frame has no header (the tab bar gives access to menu and account). */
const NO_MOBILE_HEADER = new Set(['/', '/nft/$nftId', '/cart', '/_authenticated/checkout', '/login', '/register'])
function useHidesMobileHeader() {
  return useRouterState({ select: (state) => state.matches.some((match) => NO_MOBILE_HEADER.has(match.routeId)) })
}

function AccountSlot({ variant }: { variant: 'header' | 'menu' }) {
  const { user, status, retry, retrying } = useSession()
  const logout = useLogout()
  if (status === 'error') {
    // The stored session could not be validated (network/5xx): neither "Entrar" nor the account menu is right.
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={retry}
        disabled={retrying}
        aria-label="Não foi possível verificar a sessão. Tentar novamente"
        className={cn('h-[35px] gap-1.5', variant === 'menu' && 'w-full')}
      >
        <RotateCw className={cn('size-4', retrying && 'animate-spin')} aria-hidden="true" />
        Tentar novamente
      </Button>
    )
  }
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
  const actionBar = useHasActionBar()

  return (
    <SessionProvider>
      <HeadContent />
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
        <div className={actionBar ? 'max-md:pb-44' : hideTabBar ? undefined : 'max-md:pb-24'}>
          <SiteFooter />
          {/* Mobile: an ordinary button after the footer (above the bottom bar); desktop: floating. */}
          <DemoPanel />
        </div>
      </div>
      {hideTabBar ? null : <MobileTabBar cartCount={cartCount} account={<AccountSlot variant="menu" />} />}
    </SessionProvider>
  )
}
