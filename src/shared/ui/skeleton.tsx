import { cn } from '@/shared/lib/utils'

/**
 * Shimmer placeholder. Give it the final dimensions of the content it replaces (no layout
 * shift). The animation stops under `prefers-reduced-motion` (see `.shimmer` in index.css).
 * Decorative: the busy state is announced by the container (`aria-busy` + label).
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('shimmer rounded-sm', className)} {...props} />
}

export { Skeleton }
