import { Minus, Plus } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

/**
 * Cart quantity stepper. Desktop: the orange 20x30 pills of the cart table; mobile: the dark
 * 24px squares of the mobile cart. Decrease is disabled at 1, increase at the edition limit.
 */
export function CartStepper({
  label,
  value,
  max,
  onChange,
  disabled = false,
}: {
  /** Item label used in the button names ("Aumentar quantidade de …"). */
  label: string
  value: number
  max: number
  onChange: (value: number) => void
  disabled?: boolean
}) {
  const button =
    'grid cursor-pointer place-content-center transition-colors disabled:cursor-not-allowed disabled:opacity-40 size-6 rounded-[6px] border border-line bg-surface-raised text-foreground hover:border-brand md:h-[30px] md:w-5 md:rounded-[20px] md:border-ink md:bg-brand md:text-ink md:shadow-button md:hover:bg-brand-accent'
  return (
    <div role="group" aria-label={`Quantidade de ${label}`} className="flex items-center gap-3">
      <button
        type="button"
        className={button}
        disabled={disabled || value <= 1}
        aria-label={`Diminuir quantidade de ${label}`}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
      <output aria-live="polite" aria-atomic="true" className={cn('min-w-[1.5ch] text-center text-base leading-[22px] text-foreground md:text-[17px] md:leading-6')}>
        {value}
      </output>
      <button
        type="button"
        className={button}
        disabled={disabled || value >= max}
        aria-label={`Aumentar quantidade de ${label}`}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}
