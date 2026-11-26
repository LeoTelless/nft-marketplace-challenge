import { CircleAlert, Eye } from 'lucide-react'
import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { ArrowDownIcon, HideIcon, HideOutlineIcon } from '@/shared/ui/icons'
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
  /**
   * `visible` (default): the hint sits under the field. `on-error`: the hint is always read by
   * assistive tech (`aria-describedby`) but only shown, under the error, once the field is
   * invalid, so a layout without hints (auth modal) keeps its grid.
   */
  hintMode?: 'visible' | 'on-error'
  /** Label box: 29px (frames with the 22px asterisk) or 15px (password fields of the profile). */
  labelSize?: 'default' | 'compact'
  className?: string
  /** Extra classes for the control itself. */
  inputClassName?: string
}

function useFieldIds(error?: string, hint?: ReactNode, hintMode: FieldChrome['hintMode'] = 'visible') {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  // A visible hint is replaced by the error; an on-error hint is read together with it.
  let describedBy: string | undefined
  if (error) describedBy = hint && hintMode === 'on-error' ? `${errorId} ${hintId}` : errorId
  else if (hint) describedBy = hintId
  return { id, errorId, hintId, describedBy }
}

/** Radius of the flow fields: 3px in the payment, profile and wallet frames. */
export const FIELD_RADIUS = 'rounded-[3px]'

export function FieldLabel({
  htmlFor,
  label,
  required,
  hidden,
  size = 'default',
}: {
  htmlFor: string
  label: string
  required?: boolean
  hidden?: boolean
  size?: FieldChrome['labelSize']
}) {
  // The asterisk stays outside the <label>, so the accessible name is exactly the label text.
  return (
    <div className={cn('flex items-center', size === 'compact' ? 'h-[15px]' : 'h-[29px]', hidden && 'sr-only')}>
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

export function FieldMessages({
  errorId,
  hintId,
  error,
  hint,
  hintMode = 'visible',
}: {
  errorId: string
  hintId: string
  error?: string
  hint?: ReactNode
  hintMode?: FieldChrome['hintMode']
}) {
  if (error) {
    return (
      <>
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-4 text-coral">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
        {hint && hintMode === 'on-error' ? (
          <p id={hintId} className="mt-1 text-xs leading-4 text-text-muted">
            {hint}
          </p>
        ) : null}
      </>
    )
  }
  return hint ? (
    <p id={hintId} className={cn('mt-1.5 text-xs leading-4 text-text-muted', hintMode === 'on-error' && 'sr-only')}>
      {hint}
    </p>
  ) : null
}

/** Auth fields: 50px with a 10px radius on mobile, 40px with a 5px radius in the desktop modal. */
const tallInput = 'h-[50px] rounded-[10px] px-4 md:h-10 md:rounded-[5px]'

export function TextField({
  label,
  error,
  hint,
  required,
  hideLabel,
  hintMode,
  labelSize,
  className,
  inputClassName,
  tall,
  ...props
}: FieldChrome & ComponentProps<'input'> & { tall?: boolean }) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint, hintMode)
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} size={labelSize} />
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        className={cn(tall ? tallInput : FIELD_RADIUS, props.readOnly && 'cursor-default text-text-secondary focus-visible:border-line', inputClassName)}
        {...props}
      />
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} hintMode={hintMode} />
    </div>
  )
}

/** Password with a show/hide toggle (Figma Iconly "Hide" eye). */
export function PasswordField({
  label,
  error,
  hint,
  required,
  hideLabel,
  hintMode,
  labelSize,
  className,
  inputClassName,
  tall,
  ...props
}: FieldChrome & Omit<ComponentProps<'input'>, 'type'> & { tall?: boolean }) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint, hintMode)
  const [visible, setVisible] = useState(false)
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} size={labelSize} />
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn('pr-12', tall ? tallInput : FIELD_RADIUS, tall && 'pr-12', inputClassName)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
          // Auth: Iconly Curved "Hide" (18px #55321F on mobile, 23x20 #B39463 in the modal);
          // profile: Light-Outline "Hide", 20px #B39463.
          className={cn(
            'absolute inset-y-0 right-1 my-auto grid size-9 cursor-pointer place-content-center rounded-sm hover:text-brand-accent',
            tall ? 'text-line-soft md:text-text-muted' : 'text-text-muted',
          )}
        >
          {visible ? (
            <Eye className="size-5" aria-hidden="true" />
          ) : tall ? (
            <HideIcon className="h-[18px] w-[18px] md:h-5 md:w-[23px]" />
          ) : (
            <HideOutlineIcon className="size-5" />
          )}
        </button>
      </div>
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} hintMode={hintMode} />
    </div>
  )
}

/** Native select styled as the Figma dropdown ("Arrow-Down", 20px #B39463). */
export function SelectField({
  label,
  error,
  hint,
  required,
  hideLabel,
  hintMode,
  labelSize,
  className,
  inputClassName,
  children,
  ...props
}: FieldChrome & ComponentProps<'select'>) {
  const { id, errorId, hintId, describedBy } = useFieldIds(error, hint, hintMode)
  return (
    <div className={cn('flex min-w-0 flex-col', className)}>
      <FieldLabel htmlFor={id} label={label} required={required} hidden={hideLabel} size={labelSize} />
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          aria-required={required || undefined}
          className={cn(
            'h-10 w-full cursor-pointer appearance-none border border-line bg-transparent py-2 pr-14 pl-3 [&>option]:bg-surface text-sm text-foreground outline-hidden hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-coral',
            FIELD_RADIUS,
            inputClassName,
          )}
          {...props}
        >
          {children}
        </select>
        <ArrowDownIcon className="pointer-events-none absolute inset-y-0 right-7 my-auto size-5 text-text-muted" />
      </div>
      <FieldMessages errorId={errorId} hintId={hintId} error={error} hint={hint} hintMode={hintMode} />
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
