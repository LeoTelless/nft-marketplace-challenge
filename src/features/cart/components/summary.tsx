import { X } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import type { Network, Quote } from '@/contracts'
import { CircleAlert } from 'lucide-react'
import { formatEth } from '@/shared/lib/eth'
import { cn } from '@/shared/lib/utils'
import { Skeleton } from '@/shared/ui/skeleton'
import { useCoupon } from '../use-quote'

const eth = (value: string) => formatEth(value, { maxDecimals: 6 })

/**
 * Subtotal, discount, network fee and total exactly as computed by the API quote.
 * Shimmer while the first quote loads; while a newer quote is computed the previous values
 * stay visible, dimmed, with an "Atualizando…" note (`aria-busy`).
 */
export function SummaryRows({ quote, updating, className }: { quote: Quote | undefined; updating: boolean; className?: string }) {
  if (!quote) {
    return (
      <div aria-busy="true" aria-label="Calculando valores" className={cn('flex flex-col gap-3', className)}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex justify-between gap-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    )
  }
  const hasDiscount = quote.discount !== '0'
  return (
    <div aria-busy={updating || undefined} className={cn('flex flex-col gap-3 transition-opacity', updating && 'opacity-70', className)}>
      <dl className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[15px] leading-5">Subtotal</dt>
          <dd className="text-right text-base leading-4 md:text-lg" data-testid="summary-subtotal">
            {eth(quote.subtotal)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-[15px] leading-5">
            {quote.coupon ? `Desconto (${quote.coupon.code}, −${quote.coupon.percentOff}%)` : 'Desconto do lançamento'}
          </dt>
          <dd className="text-right text-[15px] leading-5" data-testid="summary-discount">
            (-) {hasDiscount ? eth(quote.discount) : '00.00'}
          </dd>
        </div>
        <div className="flex flex-col gap-0 md:gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-[15px] leading-5">Taxa de rede</dt>
            <dd className="text-right text-base leading-4 md:text-lg" data-testid="summary-fee">
              {eth(quote.networkFee)}
            </dd>
          </div>
          <p className="text-right text-xs leading-4 text-brand-accent">Taxa estimada</p>
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-4 md:mt-3">
          <dt className="text-base leading-4 font-bold">Total</dt>
          <dd className="text-right text-lg leading-4 font-bold text-brand-accent" data-testid="summary-total">
            {eth(quote.total)}
          </dd>
        </div>
      </dl>
      {updating ? <p className="text-right text-xs text-text-muted">Atualizando valores…</p> : null}
      {quote.issues.length ? (
        <ul className="flex flex-col gap-1 text-[13px] leading-4 text-coral">
          {quote.issues.map((issue) => (
            <li key={`${issue.nftId}-${issue.editionId}`} className="flex gap-1.5">
              <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/**
 * "Código promocional": validated by the API (invalid and expired have distinct messages);
 * once applied it shows as a removable chip.
 */
export function CouponForm({ network, compact = false }: { network?: Network; compact?: boolean }) {
  const coupon = useCoupon(network)
  const [code, setCode] = useState('')
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
    if (code.trim()) coupon.apply(code, { onSuccess: () => setCode('') })
  }

  return (
    <form onSubmit={submit} aria-label="Cupom" className="flex flex-col gap-2" noValidate>
      <label htmlFor={id} className={cn('text-sm leading-4 font-bold', compact ? 'sr-only' : 'max-md:sr-only')}>
        Código promocional
      </label>
      <div
        className={cn(
          'flex h-[50px] items-stretch overflow-hidden rounded-full border border-line bg-surface md:h-10 md:rounded-none md:border-brand md:bg-transparent',
          coupon.error && 'border-coral md:border-coral',
        )}
      >
        <input
          id={id}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Digite o código promocional..."
          autoComplete="off"
          aria-invalid={coupon.error ? true : undefined}
          aria-describedby={coupon.error ? `${id}-error` : undefined}
          className="min-w-0 flex-1 bg-transparent px-4 text-[13px] text-foreground outline-hidden placeholder:text-text-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-accent md:px-2 md:text-xs"
        />
        <button
          type="submit"
          disabled={coupon.isApplying || !code.trim()}
          className="w-[97px] shrink-0 cursor-pointer rounded-full bg-linear-120 from-brand to-[#a86c3c] text-[15px] font-bold text-foreground disabled:cursor-not-allowed disabled:opacity-60 md:w-[102px] md:rounded-none md:bg-brand md:bg-none md:text-ink"
        >
          {coupon.isApplying ? 'Aplicando…' : 'Aplicar'}
        </button>
      </div>
      {coupon.error ? (
        <p id={`${id}-error`} role="alert" className="flex items-start gap-1.5 text-[13px] leading-4 text-coral">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {coupon.error}
        </p>
      ) : null}
    </form>
  )
}
