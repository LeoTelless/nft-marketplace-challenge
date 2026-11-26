import * as React from 'react'
import { CheckIcon } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from '@/shared/lib/utils'

/** Checked state is shown by fill **and** a check mark (never by color alone). */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-[18px] shrink-0 cursor-pointer rounded-xs border border-line-soft bg-surface-dark transition-colors outline-none',
        'hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
        'disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-coral',
        'data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-ink',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="grid place-content-center text-current">
        <CheckIcon className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
