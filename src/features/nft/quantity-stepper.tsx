import { Minus, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Quantity stepper (Figma: orange pill buttons around the value). Decrease is disabled at
 * the minimum, increase at the limit; the value is announced politely.
 * Arrow keys and Home/End work on the group as on a native spin button.
 */
export function QuantityStepper({
  value,
  min = 1,
  max,
  onChange,
  disabled = false,
  labelId,
  describedBy,
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
  labelId: string
  describedBy?: string
  className?: string
}) {
  const canDecrease = !disabled && value > min
  const canIncrease = !disabled && value < max
  const button =
    'grid h-[30px] w-5 cursor-pointer place-content-center rounded-[20px] border border-ink bg-brand text-ink shadow-button transition-colors hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-40 md:h-[50px] md:w-[33px] md:rounded-[33px]'
  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={describedBy}
      className={cn('flex items-center gap-3', className)}
      onKeyDown={(event) => {
        if (disabled) return
        const next =
          event.key === 'ArrowUp' || event.key === 'ArrowRight'
            ? value + 1
            : event.key === 'ArrowDown' || event.key === 'ArrowLeft'
              ? value - 1
              : event.key === 'Home'
                ? min
                : event.key === 'End'
                  ? max
                  : null
        if (next === null) return
        event.preventDefault()
        onChange(Math.min(Math.max(next, min), max))
      }}
    >
      <button
        type="button"
        className={button}
        disabled={!canDecrease}
        aria-label="Diminuir quantidade"
        onClick={() => onChange(Math.max(value - 1, min))}
      >
        <Minus className="size-4 md:size-6" strokeWidth={2.5} aria-hidden="true" />
      </button>
      <output
        aria-live="polite"
        aria-atomic="true"
        data-testid="quantity-value"
        className="min-w-[1.5ch] text-center text-lg leading-[25px] font-medium text-foreground md:text-xl md:leading-7 md:font-normal"
      >
        {value}
      </output>
      <button
        type="button"
        className={button}
        disabled={!canIncrease}
        aria-label="Aumentar quantidade"
        onClick={() => onChange(Math.min(value + 1, max))}
      >
        <Plus className="size-4 md:size-6" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}
