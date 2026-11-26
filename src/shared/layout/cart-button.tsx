import { Link } from '@tanstack/react-router'
import { cn } from '@/shared/lib/utils'
import { CartIcon } from '@/shared/ui/icons'

/**
 * Header cart link with the item counter (Figma: 24px cart + 16px orange badge with an ink
 * ring). Presentational: the count comes from the caller (`useCartCount()`).
 */
export function CartButton({ count, className }: { count: number; className?: string }) {
  const label = count === 0 ? 'Carrinho vazio' : `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`
  return (
    <Link
      to="/cart"
      aria-label={label}
      data-testid="header-cart"
      className={cn('relative grid size-10 place-content-center rounded-full text-foreground hover:text-brand-accent', className)}
    >
      <CartIcon className="size-6" />
      {count > 0 ? (
        <span
          aria-hidden="true"
          data-testid="cart-count"
          className="absolute top-1 right-0 grid h-4 min-w-4 place-content-center rounded-full bg-brand px-1 text-[10px] leading-[13px] font-medium text-ink ring-2 ring-ink"
        >
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  )
}
