import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import type { CartItem } from '@/contracts'
import { QuoteSummary } from '@/features/cart/quote-summary'
import { describeCartItem, useCart } from '@/features/cart/use-cart'
import { useCartChangeNotices } from '@/features/cart/use-cart-change-notices'
import { useRemoveCartItem, useUpdateCartItem } from '@/features/cart/use-cart-mutations'
import { useCoupon, useQuote } from '@/features/cart/use-quote'
import { apiErrorMessage } from '@/shared/lib/form-errors'
import { formatEth } from '@/shared/lib/eth'
import { Button } from '@/shared/ui/button'

/** Provisional cart screen (flow skeleton; the Figma layout comes in stage 2). */
export const Route = createFileRoute('/cart')({
  head: () => ({ meta: [{ title: 'Carrinho | KURIO' }] }),
  component: CartPage,
})

function CartPage() {
  const cart = useCart()
  const quote = useQuote()
  useCartChangeNotices(cart.owner)

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Carrinho</h1>
      {cart.isPending ? (
        <p aria-busy="true">Carregando carrinho…</p>
      ) : cart.isError ? (
        <div role="alert">
          <p>Não foi possível carregar o carrinho: {apiErrorMessage(cart.error)}</p>
          <Button variant="secondary" onClick={() => void cart.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : cart.data.items.length === 0 ? (
        <p>
          Seu carrinho está vazio.{' '}
          <Link to="/" className="underline">
            Continuar explorando
          </Link>
        </p>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <ul aria-label="Itens do carrinho" className="flex flex-col gap-3">
            {cart.data.items.map((item) => (
              <CartLine key={item.id} item={item} />
            ))}
          </ul>
          <div className="flex flex-col gap-4">
            <CouponForm />
            <QuoteSummary quote={quote.data} updating={quote.isUpdating} />
            {quote.data?.issues.length ? (
              <p className="text-sm">Ajuste os itens indisponíveis para finalizar a compra.</p>
            ) : (
              <Button asChild>
                <Link to="/checkout">Finalizar compra</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function CartLine({ item }: { item: CartItem }) {
  const update = useUpdateCartItem()
  const remove = useRemoveCartItem()
  const state = describeCartItem(item)
  const label = `${item.nftName} (${item.editionName})`

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-md border p-3" aria-label={label}>
      <img src={item.imageUrl} alt="" width={64} height={64} className="size-16 rounded object-cover" />
      <div className="flex-1">
        <p className="font-medium">{item.nftName}</p>
        <p className="text-sm opacity-80">Edição {item.editionName}</p>
        <p className="text-sm">
          {formatEth(item.unitPrice, { maxDecimals: 6 })}
          {state.priceChanged ? (
            <span className="ml-2 text-xs">
              (preço {state.priceDirection === 'up' ? 'subiu' : 'caiu'}; era {formatEth(item.addedUnitPrice, { maxDecimals: 6 })})
            </span>
          ) : null}
        </p>
        {state.soldOut ? (
          <p className="text-sm text-coral">Esgotado: remova o item para finalizar.</p>
        ) : state.exceedsAvailability ? (
          <p className="text-sm text-coral">Restam apenas {item.available} unidade(s).</p>
        ) : null}
      </div>
      <div role="group" aria-label={`Quantidade de ${label}`} className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={`Diminuir quantidade de ${label}`}
          disabled={item.quantity <= 1}
          onClick={() => update.mutate({ item, quantity: item.quantity - 1 })}
        >
          −
        </Button>
        <output aria-live="polite" aria-label={`Quantidade de ${label}`} className="min-w-6 text-center">
          {item.quantity}
        </output>
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label={`Aumentar quantidade de ${label}`}
          disabled={item.quantity >= state.max}
          onClick={() => update.mutate({ item, quantity: item.quantity + 1 })}
        >
          +
        </Button>
      </div>
      <Button variant="destructive" size="sm" aria-label={`Remover ${label}`} onClick={() => remove.mutate({ item })}>
        Remover
      </Button>
    </li>
  )
}

function CouponForm() {
  const coupon = useCoupon()
  const [code, setCode] = useState('')

  if (coupon.applied) {
    return (
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          Cupom <strong>{coupon.applied}</strong> aplicado
        </span>
        <Button variant="link" onClick={coupon.remove}>
          Remover cupom
        </Button>
      </div>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (code.trim()) coupon.apply(code, { onSuccess: () => setCode('') })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1" aria-label="Cupom">
      <label htmlFor="coupon-code" className="text-sm">
        Código promocional
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código promocional..."
          aria-invalid={coupon.error ? true : undefined}
          aria-describedby={coupon.error ? 'coupon-error' : undefined}
          className="h-9 flex-1 rounded-sm border bg-transparent px-2 text-sm"
        />
        <Button type="submit" size="sm" disabled={coupon.isApplying || !code.trim()}>
          Aplicar
        </Button>
      </div>
      {coupon.error ? (
        <p id="coupon-error" role="alert" className="text-xs text-coral">
          {coupon.error}
        </p>
      ) : null}
    </form>
  )
}
