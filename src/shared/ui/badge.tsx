import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/shared/lib/utils'

/** Labels such as "RARO" (mobile card) and availability states. Text always carries the meaning. */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 rounded-xs px-2 py-0.5 text-[13px] leading-4 font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'bg-brand text-ink',
        outline: 'border border-line-soft bg-surface-dark text-brand-accent',
        muted: 'border border-line bg-surface-raised text-text-secondary',
        success: 'border border-success/60 bg-success/10 text-foreground',
        danger: 'border border-coral/60 bg-coral/10 text-coral',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

function Badge({ className, variant, ...props }: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
