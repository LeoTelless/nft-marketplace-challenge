import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '@/shared/lib/utils'
import { buttonVariants } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import {
  ActivityIcon,
  ChevronDownIcon,
  HeartIcon,
  LoginIcon,
  LogoutIcon,
  UserIcon,
  WalletIcon,
} from '@/shared/ui/icons'

/** "Entrar" button of the header (Figma: 100x35, logout glyph + 16px medium label). */
export function LoginButton({ className }: { className?: string }) {
  // Come back to the current screen after logging in.
  const href = useRouterState({ select: (state) => state.location.href })
  return (
    <Link
      to="/login"
      search={{ redirect: href }}
      className={cn(buttonVariants(), 'h-[35px] gap-1 px-[9px] text-base font-medium', className)}
      data-testid="header-login"
    >
      <LoginIcon className="size-5" />
      Entrar
    </Link>
  )
}

/**
 * Account menu that replaces "Entrar" once authenticated: profile, wallets and logout.
 * Presentational: the session data and the logout action come from the caller.
 */
export function UserMenu({
  name,
  email,
  onLogout,
  loggingOut = false,
}: {
  name: string
  email?: string
  onLogout: () => void
  loggingOut?: boolean
}) {
  const firstName = name.split(' ')[0] || name
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        data-testid="user-menu"
        aria-label={`Conta de ${name}`}
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'h-[35px] max-w-[180px] gap-1.5 px-2.5 text-base font-medium data-[state=open]:bg-brand/10',
        )}
      >
        <UserIcon className="size-5" />
        <span className="truncate">{firstName}</span>
        <ChevronDownIcon className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>
          <span className="block truncate font-bold text-foreground">{name}</span>
          {email ? <span className="block truncate">{email}</span> : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account/profile">
            <UserIcon /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account/wallets">
            <WalletIcon /> Carteiras
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/orders">
            <ActivityIcon /> Meus pedidos
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account/favorites">
            <HeartIcon /> Lista de interesse
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={loggingOut} onSelect={onLogout} data-testid="logout">
          <LogoutIcon /> {loggingOut ? 'Saindo…' : 'Sair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
