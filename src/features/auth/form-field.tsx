import { useId, type ComponentProps, type ReactNode } from 'react'
import { Input } from '@/shared/ui/input'

/**
 * Labelled input with an accessible error (`aria-invalid` + `aria-describedby`).
 * Provisional building block of the flow skeleton screens (stage 2 restyles them).
 */
export function TextField({
  label,
  error,
  hint,
  required,
  ...props
}: ComponentProps<'input'> & { label: string; error?: string; hint?: ReactNode }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm">
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} aria-required={required || undefined} {...props} />
      {hint ? (
        <p id={hintId} className="text-xs opacity-70">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-coral">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** Form-level error (e.g. invalid credentials), announced when it appears. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-coral">
      {message}
    </p>
  )
}
