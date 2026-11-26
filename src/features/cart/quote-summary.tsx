import type { Quote } from '@/contracts'
import { formatEth } from '@/shared/lib/eth'

/**
 * Totals exactly as computed by the API quote (never recomputed here).
 * Provisional presentation for the flow skeletons.
 */
export function QuoteSummary({ quote, updating, title = 'Resumo do pedido' }: { quote: Quote | undefined; updating: boolean; title?: string }) {
  return (
    <section aria-label={title} aria-busy={updating || undefined} className="flex flex-col gap-2 rounded-md border p-4">
      <h2 className="font-semibold">{title}</h2>
      {quote ? (
        <dl className="grid grid-cols-2 gap-1 text-sm">
          <dt>Subtotal</dt>
          <dd className="text-right" data-testid="summary-subtotal">
            {formatEth(quote.subtotal, { maxDecimals: 6 })}
          </dd>
          <dt>Desconto{quote.coupon ? ` (${quote.coupon.code} −${quote.coupon.percentOff}%)` : ''}</dt>
          <dd className="text-right" data-testid="summary-discount">
            {quote.discount === '0' ? formatEth('0') : `− ${formatEth(quote.discount, { maxDecimals: 6 })}`}
          </dd>
          <dt>Taxa de rede</dt>
          <dd className="text-right" data-testid="summary-fee">
            {formatEth(quote.networkFee, { maxDecimals: 6 })}
          </dd>
          <dt className="font-semibold">Total</dt>
          <dd className="text-right font-semibold" data-testid="summary-total">
            {formatEth(quote.total, { maxDecimals: 6 })}
          </dd>
        </dl>
      ) : (
        <p className="text-sm">Calculando valores…</p>
      )}
      {updating && quote ? <p className="text-xs opacity-70">Atualizando valores…</p> : null}
      {quote?.issues.length ? (
        <ul className="text-sm text-coral">
          {quote.issues.map((issue) => (
            <li key={`${issue.nftId}-${issue.editionId}`}>{issue.message}</li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
