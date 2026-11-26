import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Menu } from 'lucide-react'
import { Popover as PopoverPrimitive } from 'radix-ui'
import { useState, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { SearchIcon } from '@/shared/ui/icons'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/shared/ui/sheet'

type NavKey = 'home' | 'market'

function useActiveNav(): NavKey | null {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/nft/')) return 'market'
  return null
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="KURIO, página inicial"
      className={cn('text-sm leading-[18px] font-bold tracking-[0.1em] text-foreground', className)}
    >
      KURIO
    </Link>
  )
}

const navItemClass = (active: boolean) =>
  cn(
    'relative flex h-[45px] items-start text-base leading-[21px] whitespace-nowrap transition-colors',
    'after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:bg-brand after:transition-opacity',
    active
      ? 'font-bold text-brand-accent after:opacity-100'
      : 'text-foreground after:opacity-0 hover:text-brand-accent',
  )

/** Pages outside the scope (editorial): shown, but clearly not navigable. */
function ComingSoon({ children, className }: { children: string; className?: string }) {
  return (
    <span aria-disabled="true" className={cn('cursor-not-allowed text-text-secondary', className)}>
      {children}
      {/* Visible text, not only color/cursor (A11Y-10). */}
      <span className="ml-1 self-start rounded-xs border border-line-soft px-1 text-[10px] leading-[14px] font-normal tracking-normal text-text-muted">
        <span className="sr-only">(</span>em breve<span className="sr-only">)</span>
      </span>
    </span>
  )
}

function DesktopNav() {
  const active = useActiveNav()
  return (
    <nav aria-label="Principal">
      <ul className="flex items-start gap-6 lg:gap-10">
        <li>
          <Link
            to="/"
            aria-current={active === 'home' ? 'page' : undefined}
            className={navItemClass(active === 'home')}
          >
            Início
          </Link>
        </li>
        <li>
          <Link
            to="/"
            hash="catalogo"
            activeOptions={{ includeHash: true }}
            className={navItemClass(active === 'market')}
          >
            Mercado
          </Link>
        </li>
        <li>
          <ComingSoon className={navItemClass(false)}>Criadores</ComingSoon>
        </li>
        <li>
          <ComingSoon className={navItemClass(false)}>Aprenda</ComingSoon>
        </li>
      </ul>
    </nav>
  )
}

/** Header search: a small popover; submitting opens the catalog filtered by the term. */
function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const navigate = useNavigate()
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        aria-label="Buscar NFTs"
        className="grid size-10 cursor-pointer place-content-center rounded-full text-foreground hover:text-brand-accent data-[state=open]:text-brand-accent"
      >
        <SearchIcon className="size-5" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(320px,calc(100vw-2rem))] rounded-md border border-line bg-popover p-3 shadow-raised"
        >
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault()
              setOpen(false)
              void navigate({ to: '/', search: { q: term.trim() || undefined }, hash: 'catalogo' })
            }}
            className="flex gap-2"
          >
            <label htmlFor="header-search" className="sr-only">
              Buscar NFTs por nome, criador ou descrição
            </label>
            <input
              id="header-search"
              type="search"
              autoComplete="off"
              maxLength={100}
              placeholder="Explorar coleções"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-surface-dark px-3 text-sm text-foreground placeholder:text-text-muted focus-visible:border-brand"
            />
            <button
              type="submit"
              className="h-10 cursor-pointer rounded-sm bg-brand px-3 text-sm font-bold text-ink hover:bg-brand-accent"
            >
              Buscar
            </button>
          </form>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

/** Mobile/tablet (< 1024px) navigation drawer (Radix Dialog: focus trapped, Esc closes, focus returns). */
/**
 * Navigation + account drawer. Opened by the hamburger of the compact header (tablet and screens
 * without a mobile frame) or by the "Conta" tab of the mobile tab bar.
 */
export function MobileMenu({ account, trigger }: { account: ReactNode; trigger?: ReactNode }) {
  const active = useActiveNav()
  const [open, setOpen] = useState(false)
  const linkClass = (isActive: boolean) =>
    cn(
      'flex h-12 items-center border-b border-line text-base',
      isActive ? 'font-bold text-brand-accent' : 'text-foreground',
    )
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? (
        <SheetTrigger asChild>{trigger}</SheetTrigger>
      ) : (
        <SheetTrigger
          aria-label="Abrir menu"
          className="grid size-10 cursor-pointer place-content-center rounded-full text-foreground hover:text-brand-accent lg:hidden"
        >
          <Menu className="size-6" aria-hidden="true" />
        </SheetTrigger>
      )}
      <SheetContent
        side="right"
        className="w-[85%] max-w-sm gap-0 p-0"
        // Any link followed from the drawer (account links included, even from the portaled
        // user menu: React events bubble through portals) closes it.
        onClickCapture={(event) => {
          if ((event.target as HTMLElement).closest('a[href]')) setOpen(false)
        }}
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação principal e conta</SheetDescription>
        </SheetHeader>
        <nav aria-label="Principal (menu)" className="px-6 pt-2">
          <ul>
            <li>
              <SheetClose asChild>
                <Link
                  to="/"
                  aria-current={active === 'home' ? 'page' : undefined}
                  className={linkClass(active === 'home')}
                >
                  Início
                </Link>
              </SheetClose>
            </li>
            <li>
              <SheetClose asChild>
                <Link
                  to="/"
                  hash="catalogo"
                  activeOptions={{ includeHash: true }}
                  className={linkClass(active === 'market')}
                >
                  Mercado
                </Link>
              </SheetClose>
            </li>
            <li>
              <ComingSoon className={cn(linkClass(false), 'text-text-muted')}>Criadores</ComingSoon>
            </li>
            <li>
              <ComingSoon className={cn(linkClass(false), 'text-text-muted')}>Aprenda</ComingSoon>
            </li>
          </ul>
        </nav>
        <div className="mt-auto border-t border-line px-6 py-5">{account}</div>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Header of every screen ("Header With Divider"): wordmark, main navigation, search, cart and
 * account. `cart` and `account` are slots filled by the root layout with session-aware
 * components (`CartButton`, `LoginButton` / `UserMenu`).
 */
export function SiteHeader({
  cart,
  account,
  mobileAccount,
  hideBelowMd = false,
}: {
  cart: ReactNode
  account: ReactNode
  mobileAccount: ReactNode
  /** Screens whose mobile frame has no header (Início, Detalhe): the tab bar takes over. */
  hideBelowMd?: boolean
}) {
  return (
    <header className={cn('container-page pt-4 md:pt-6', hideBelowMd && 'max-md:hidden')}>
      <div className="relative flex h-[45px] items-start justify-between border-b border-brand/30">
        <div className="flex h-[35px] items-center lg:w-40">
          <Logo />
        </div>
        <div className="absolute left-1/2 hidden -translate-x-1/2 lg:block xl:left-[376px] xl:translate-x-0">
          <DesktopNav />
        </div>
        {/* Frame (lg+): 20px search glyph, 28px to the 24px cart, 28px to "Entrar"; the 40px hit areas overlap the gaps. */}
        <div className="flex h-[35px] items-center gap-1 md:gap-2 lg:gap-0">
          <div className="lg:mr-[10px]">
            <HeaderSearch />
          </div>
          <div className="lg:mr-[27px]">{cart}</div>
          <div className="hidden md:block">{account}</div>
          <MobileMenu account={mobileAccount} />
        </div>
      </div>
    </header>
  )
}
