import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

/**
 * KURIO buttons: 6px radius, Roboto Mono, ink text on the primary orange (6.85:1).
 * Sizes follow the Figma (40px "COMPRAR"/"EXPLORAR", 36px "Aplicar", 35px header "Entrar").
 */
const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: 'bg-brand text-ink hover:bg-brand-accent',
        destructive: 'border border-coral text-coral hover:bg-coral/10',
        outline: 'border border-brand text-brand-accent hover:bg-brand/10',
        secondary: 'border border-line bg-surface-raised text-foreground hover:border-brand',
        ghost: 'text-foreground hover:bg-surface-raised',
        link: 'h-auto px-0 text-brand-accent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 text-sm',
        xs: 'h-7 gap-1 px-2 text-xs [&_svg:not([class*=size-])]:size-3.5',
        sm: 'h-9 px-3 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-xs': 'size-7 [&_svg:not([class*=size-])]:size-3.5',
        'icon-sm': 'size-9',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant = 'default',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : 'button'

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
