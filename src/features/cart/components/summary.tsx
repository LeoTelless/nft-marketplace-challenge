import { CircleAlert, X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import type { Network, Quote } from '@/contracts'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'
import { cartItemLabel, exactEth } from '../format'
import { useCoupon } from '../use-quote'

/** Issue text built in the UI language (edition names translated), not the API's text. */
function issueMessage(quote: Quote, issue: Quote['issues'][number]) {
  const line = quote.lines.find((l) => l.nftId === issue.nftId && l.editionId === issue.editionId)
  if (!line) return issue.message
  const label = cartItemLabel(line)
  return issue.type === 'sold_out' ? `${label} está esgotado.` : `Restam apenas ${line.available} unidade(s) de ${label}.`
}

/**
 * Subtotal, discount, network fee and total exactly as computed by the API quote (the full
 * value, never rounded). Shimmer while the first quote loads; while a newer quote is computed
 * the previous values stay visible, dimmed, with an "Atualizando…" note (`aria-busy`).
 *
 * `variant`: the cart summary (estimated-fee note on the right, full-width total) or the
 * payment summary of the desktop frame (note centered, rule above a 321px centered total).
 */
export function SummaryRows({
  quote,
  updating,
  className,
  variant = 'cart',
}: {
  quote: Quote | undefined
  updating: boolean
  className?: string
  variant?: 'cart' | 'checkout'
}) {
  const checkout = variant === 'checkout'
  if (!quote) {
    // Same rows and heights as the loaded summary (subtotal, discount, fee + note, total), so
    // nothing below moves when the quote arrives.
    return (
      <div aria-busy="true" aria-label="Calculando valores" className={cn('flex flex-col gap-3', className)}>
        <div className="flex h-5 justify-between gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex h-5 justify-between gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-5 w-20" />
        </div>
        <div className="flex flex-col gap-0 md:gap-3">
          <div className="flex h-5 justify-between gap-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div className={cn('flex h-4', checkout ? 'justify-end md:justify-center' : 'justify-end')}>
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <div className={cn('flex h-4 justify-between gap-4 md:mt-3', checkout && 'md:mx-auto md:mt-0 md:w-full md:max-w-[321px]')}>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
    )
  }
  return (
    <div aria-busy={updating || undefined} className={cn('flex flex-col gap-3 transition-opacity', updating && 'opacity-70', className)}>
      <dl className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[15px] leading-5">Subtotal</dt>
          <dd className="text-right text-base leading-4 md:text-lg" data-testid="summary-subtotal">
            {exactEth(quote.subtotal)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[15px] leading-5">
            {quote.coupon ? `Desconto (${quote.coupon.code}, −${quote.coupon.percentOff}%)` : 'Desconto do lançamento'}
          </dt>
          <dd className="text-right text-[15px] leading-5" data-testid="summary-discount">
            (-) {exactEth(quote.discount)}
          </dd>
        </div>
        <div className="flex flex-col gap-0 md:gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[15px] leading-5">Taxa de rede</dt>
            <dd className="text-right text-base leading-4 md:text-lg" data-testid="summary-fee">
              {exactEth(quote.networkFee)}
            </dd>
          </div>
          <p className={cn('text-right text-xs leading-4 text-brand-accent', checkout && 'md:text-center')}>Taxa estimada</p>
        </div>
        {checkout ? <div aria-hidden="true" className="h-px bg-brand/30 max-md:hidden" /> : null}
        <div
          className={cn(
            'flex items-baseline justify-between gap-4 md:mt-3',
            checkout && 'md:mx-auto md:mt-0 md:w-full md:max-w-[321px]',
          )}
        >
          <dt className="text-base leading-4 font-bold">Total</dt>
          <dd className="text-right text-lg leading-4 font-bold text-brand-accent" data-testid="summary-total">
            {exactEth(quote.total)}
          </dd>
        </div>
      </dl>
      {updating ? <p className="text-right text-xs text-text-muted">Atualizando valores…</p> : null}
      {quote.issues.length ? (
        <ul className="flex flex-col gap-1 text-[13px] leading-4 text-coral">
          {quote.issues.map((issue) => (
            <li key={`${issue.nftId}-${issue.editionId}`} className="flex gap-1.5">
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {issueMessage(quote, issue)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * "Código promocional": validated by the API (invalid and expired have distinct messages);
 * once applied it shows as a removable chip. "Aplicar" keeps the look of the frame at rest
 * (never dimmed): an empty submit is answered with a message instead of a disabled button.
 */
export function CouponForm({ network, compact = false }: { network?: Network; compact?: boolean }) {
  const coupon = useCoupon(network)
  const [code, setCode] = useState('')
  const [empty, setEmpty] = useState(false)
  const id = useId()

  if (coupon.applied) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-brand/60 bg-brand/10 px-3 py-2 text-sm">
        <span>
          Cupom <strong className="text-brand-accent">{coupon.applied}</strong> aplicado
        </span>
        <button
          type="button"
          onClick={coupon.remove}
          className="inline-flex cursor-pointer items-center gap-1 text-brand-accent underline-offset-4 hover:underline"
        >
          <X className="size-4" aria-hidden="true" /> Remover cupom
        </button>
      </div>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!code.trim()) {
      setEmpty(true)
      return
    }
    setEmpty(false)
    coupon.apply(code, { onSuccess: () => setCode('') })
  }
  const error = empty ? 'Digite um código promocional.' : coupon.error

  return (
    <form onSubmit={submit} aria-label="Cupom" className="flex flex-col gap-2" noValidate>
      <label htmlFor={id} className={cn('text-sm leading-4 font-bold', compact ? 'sr-only' : 'max-md:sr-only')}>
        Código promocional
      </label>
      <div
        className={cn(
          // Mobile: the 50px pill with the frame shadow; desktop: 40px box with a 3px radius.
          'flex h-[50px] items-stretch overflow-hidden rounded-full border border-line bg-surface shadow-[0_6px_20px_#0A060473] md:h-10 md:rounded-[3px] md:border-brand md:bg-transparent md:shadow-none',
          error && 'border-coral md:border-coral',
        )}
      >
        <input
          id={id}
          value={code}
          onChange={(event) => {
            setCode(event.target.value)
            if (empty) setEmpty(false)
          }}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent px-3 text-xs min-[400px]:px-4 min-[400px]:text-[13px] text-foreground outline-hidden placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-brand-accent md:px-2 md:text-xs"
        />
        <button
          type="submit"
          disabled={coupon.isApplying}
          aria-busy={coupon.isApplying || undefined}
          className="w-[88px] shrink-0 cursor-pointer rounded-full min-[400px]:w-[97px] bg-linear-120 from-brand/55 to-brand text-[15px] font-bold text-foreground disabled:cursor-progress md:w-[102px] md:rounded-none md:bg-brand md:bg-none md:text-ink md:hover:bg-brand-accent"
        >
          {coupon.isApplying ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-[13px] leading-4 text-coral">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
    </form>
  )
}
