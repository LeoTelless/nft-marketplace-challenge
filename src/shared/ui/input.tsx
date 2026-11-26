import * as React from 'react'
import { cn } from '@/shared/lib/utils'

/** Figma inputs: no fill, 1px Color/Border stroke, 5px radius, muted placeholder, 14px text; orange border on focus. */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-10 w-full min-w-0 rounded-[5px] border border-line bg-transparent px-3 py-2 text-sm text-foreground transition-colors placeholder:text-text-muted',
        'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-coral',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
