import { CircleAlert, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { Input } from '@/shared/ui/input'

/**
 * Form fields of the flow screens (payment, profile, wallets, auth), following the Figma field:
 * 15px label with a coral asterisk on required fields, 40px input, error below.
 * Accessibility: `<label for>`, `aria-required`, `aria-invalid` and `aria-describedby` pointing
 * to the hint and the error; the error has an icon and text (never color only).
 */

interface FieldChrome {
  label: string
  error?: string
  hint?: ReactNode
  required?: boolean
  /** Placeholder-only layouts (auth modal): the label stays available to assistive tech. */
  hideLabel?: boolean
  className?: string
}

function useFieldIds(error?: string, hint?: ReactNode) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return { id, errorId, hintId, describedBy }
}

export function FieldLabel({ htmlFor, label, required, hidden }: { htmlFor: string; label: string; required?: boolean; hidden?: boolean }) {
  // The asterisk stays outside the <label>, so the accessible name is exactly the label text.
  return (
    <div className={cn('flex h-[29px] items-center', hidden && 'sr-only')}>
      <label htmlFor={htmlFor} className="text-[15px] leading-[15px] text-foreground">
        {label}
      </label>
      {required ? (
        <span aria-hidden="true" className="ml-0.5 text-[22px] leading-[29px] text-coral">
          *
        </span>
      ) : null}
    </div>
  )
}

export function FieldMessages({ errorId, hintId, error, hint }: { errorId: string; hintId: string; error?: string; hint?: ReactNode }) {
  return (
    <>
      {hint ? (
        <p id={hintId} className="text-xs leading-4 text-text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] leading-4 text-coral">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : null}
    </>
  )
}

const tallInput = 'h-[50px] rounded-[10px] px-4 md:h-10 md:rounded-sm'

export function TextField({
  label,
  error,
  hint,
  required,
  hideLabel,
  className,
  tall,
  ...props
}: FieldChrome & ComponentProps<'input'> & { tall?: boolean }) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint)
  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5', hideLabel && 'gap-1.5', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} />
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={cn(tall && tallInput, props.readOnly && 'cursor-default border-dashed text-text-secondary focus-visible:border-line')}
        {...props}
      />
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} />
    </div>
  )
}

/** Password with a show/hide toggle (Figma "Hide" eye icon). */
export function PasswordField({
  label,
  error,
  hint,
  required,
  hideLabel,
  className,
  tall,
  ...props
}: FieldChrome & Omit<ComponentProps<'input'>, 'type'> & { tall?: boolean }) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint)
  const [visible, setVisible] = useState(false)
  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5', hideLabel && 'gap-1.5', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} />
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn('pr-12', tall && tallInput, tall && 'pr-12')}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 my-auto grid size-9 cursor-pointer place-content-center rounded-sm text-text-muted hover:text-brand-accent"
        >
          {visible ? <Eye className="size-5" aria-hidden="true" /> : <EyeOff className="size-5" aria-hidden="true" />}
        </button>
      </div>
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} />
    </div>
  )
}

/** Native select styled as the Figma dropdown (chevron "Arrow-Down"). */
export function SelectField({
  label,
  error,
  hint,
  required,
  hideLabel,
  className,
  children,
  ...props
}: FieldChrome & ComponentProps<'select'>) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint)
  return (
    <div className={cn('flex min-w-0 flex-col gap-2.5', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} />
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className="h-10 w-full cursor-pointer appearance-none rounded-sm border border-line bg-surface-dark py-2 pr-10 pl-3 text-sm text-foreground outline-hidden hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-coral"
          {...props}
        >
          {children}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 my-auto size-[18px] text-foreground" />
      </div>
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} />
    </div>
  )
}

/** Form-level error (e.g. invalid credentials), announced when it appears. */
export function FormAlert({ message, tone = 'error', children }: { message?: string; tone?: 'error' | 'warning'; children?: ReactNode }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-sm border px-3 py-2.5 text-sm leading-5',
        tone === 'error' ? 'border-coral/60 bg-coral/10 text-foreground' : 'border-amber/60 bg-amber/10 text-foreground',
      )}
    >
      <CircleAlert className={cn('mt-0.5 size-4 shrink-0', tone === 'error' ? 'text-coral' : 'text-amber')} aria-hidden="true" />
      <div className="flex-1">
        <p>{message}</p>
        {children}
      </div>
    </div>
  )
}
