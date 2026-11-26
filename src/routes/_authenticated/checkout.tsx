import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { Network } from '@/contracts'
import { FormError, TextField } from '@/features/auth/form-field'
import { useCurrentUser } from '@/features/auth/session'
import { QuoteSummary } from '@/features/cart/quote-summary'
import { useCart } from '@/features/cart/use-cart'
import { useCartChangeNotices } from '@/features/cart/use-cart-change-notices'
import { CHECKOUT_FIELDS, checkoutFormSchema, emptyCheckoutValues, type CheckoutFormValues } from '@/features/checkout/schema'
import { checkoutDraft, useCheckout, type CheckoutOutcome, type ConfirmBlock } from '@/features/checkout/use-checkout'
import { useWalletConnection } from '@/features/wallets/use-wallet-connection'
import { PROVIDER_LABELS, useWallets } from '@/features/wallets/use-wallets'
import { applyApiErrors } from '@/shared/lib/form-errors'
import { formatEth } from '@/shared/lib/eth'
import { Button } from '@/shared/ui/button'

/** Provisional checkout screen (flow skeleton; the Figma layout comes in stage 2). */
export const Route = createFileRoute('/_authenticated/checkout')({
  head: () => ({ meta: [{ title: 'Pagamento | KURIO' }] }),
  component: CheckoutPage,
})

const NETWORK_LABELS: Record<Network, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  arbitrum: 'Arbitrum',
  base: 'Base',
}

const BLOCK_MESSAGES: Partial<Record<ConfirmBlock, string>> = {
  quote_updating: 'Atualizando os valores do pedido…',
  quote_issues: 'Há itens indisponíveis no carrinho. Ajuste o carrinho para continuar.',
  wallet_disconnected: 'A carteira foi desconectada. Conecte-a novamente para confirmar.',
  empty_cart: 'Seu carrinho está vazio.',
}

function CheckoutPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const cart = useCart()
  const wallets = useWallets()
  const connection = useWalletConnection()
  useCartChangeNotices(cart.owner)

  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: (user && checkoutDraft.get(user.id)) || emptyCheckoutValues({ email: user?.email, name: user?.name }),
  })
  const { errors } = form.formState
  const walletId = useWatch({ control: form.control, name: 'walletId' })
  const network = useWatch({ control: form.control, name: 'network' })
  const walletConnected = connection.isConnectedTo(walletId, network)
  const checkout = useCheckout({ network, walletConnected })
  const [result, setResult] = useState<{ tone: 'error' | 'warning'; message: string } | null>(null)

  // Draft saved on every change: survives refresh and session expiry (resumed after login).
  useEffect(() => {
    if (!user) return
    return form.subscribe({
      formState: { values: true },
      callback: ({ values }) => checkoutDraft.set(user.id, values),
    })
  }, [form, user])

  // Default to the primary wallet; keep the network among the ones the wallet supports.
  const selectedWallet = wallets.data?.items.find((w) => w.id === walletId) ?? null
  useEffect(() => {
    if (!walletId && wallets.data?.primary) form.setValue('walletId', wallets.data.primary.id)
  }, [walletId, wallets.data, form])
  useEffect(() => {
    if (selectedWallet && !selectedWallet.networks.includes(network)) form.setValue('network', selectedWallet.networks[0])
  }, [selectedWallet, network, form])

  const handleOutcome = (outcome: CheckoutOutcome) => {
    switch (outcome.type) {
      case 'created':
        setResult(null)
        void navigate({ to: '/orders/$orderId', params: { orderId: outcome.order.id } })
        return
      case 'quote_changed':
        setResult({ tone: 'warning', message: 'Os valores mudaram desde a sua revisão. Confira o novo resumo e confirme novamente.' })
        return
      case 'unknown_result':
        setResult({ tone: 'error', message: outcome.message })
        return
      case 'failed':
        if (applyApiErrors(outcome.error, form.setError, CHECKOUT_FIELDS)) checkout.backToForm()
        setResult({ tone: 'error', message: outcome.message })
        return
      case 'blocked':
        if (BLOCK_MESSAGES[outcome.reason]) setResult({ tone: 'warning', message: BLOCK_MESSAGES[outcome.reason]! })
        return
      case 'ignored':
        return
    }
  }

  const onReview = form.handleSubmit(() => {
    if (!walletConnected) {
      form.setError('walletId', { type: 'manual', message: 'Conecte a carteira selecionada para continuar.' })
      return
    }
    setResult(null)
    checkout.review()
  })

  const onConfirm = form.handleSubmit(async (values) => handleOutcome(await checkout.confirm(values)))
  // Re-sends the stored attempt as is (same key and body): no form validation needed.
  const onRecover = async () => handleOutcome(await checkout.confirm(form.getValues()))

  if (cart.isSuccess && cart.data.items.length === 0 && !checkout.pendingAttempt) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Pagamento</h1>
        <p>
          Seu carrinho está vazio.{' '}
          <Link to="/" className="underline">
            Continuar explorando
          </Link>
        </p>
      </div>
    )
  }

  const quote = checkout.quote.data
  const reviewing = checkout.step === 'review'

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Pagamento</h1>

      {checkout.pendingAttempt ? (
        <div role="alert" className="rounded-md border p-3">
          <p>Há uma compra enviada sem confirmação do servidor. Verifique antes de comprar de novo: a mesma compra será recuperada.</p>
          <Button className="mt-2" onClick={() => void onRecover()} disabled={checkout.isSubmitting}>
            Verificar compra em andamento
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[1fr_360px]">
        <form noValidate onSubmit={reviewing ? onConfirm : onReview} aria-label="Pagamento" className="flex flex-col gap-4">
          <fieldset disabled={reviewing} className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 font-semibold">Perfil do colecionador</legend>
            <TextField label="Nome de exibição" required error={errors.collector?.displayName?.message} {...form.register('collector.displayName')} />
            <TextField label="Nome de usuário" required autoComplete="username" error={errors.collector?.username?.message} {...form.register('collector.username')} />
            <TextField label="Nome do perfil" required error={errors.collector?.profileName?.message} {...form.register('collector.profileName')} />
            <TextField label="E-mail" type="email" required autoComplete="email" error={errors.collector?.email?.message} {...form.register('collector.email')} />
            <TextField label="Nome ENS (opcional)" hint="Sem o sufixo .eth" error={errors.collector?.ensName?.message} {...form.register('collector.ensName')} />
            <TextField label="Código de indicação (opcional)" error={errors.collector?.referralCode?.message} {...form.register('collector.referralCode')} />
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="collector-note" className="text-sm">
                Observação do colecionador (opcional)
              </label>
              <textarea
                id="collector-note"
                rows={3}
                aria-invalid={errors.collector?.note ? true : undefined}
                className="rounded-sm border bg-transparent p-2 text-sm"
                {...form.register('collector.note')}
              />
              {errors.collector?.note ? <p className="text-xs text-coral">{errors.collector.note.message}</p> : null}
            </div>
          </fieldset>

          <fieldset disabled={reviewing} className="flex flex-col gap-3">
            <legend className="mb-2 font-semibold">Carteira e rede</legend>
            {wallets.isPending ? (
              <p aria-busy="true">Carregando carteiras…</p>
            ) : wallets.data?.items.length ? (
              <div role="radiogroup" aria-label="Carteira" aria-describedby={errors.walletId ? 'wallet-error' : undefined} className="flex flex-col gap-2">
                {wallets.data.items.map((wallet) => (
                  <label key={wallet.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                    <input type="radio" value={wallet.id} {...form.register('walletId')} />
                    {wallet.label} — {PROVIDER_LABELS[wallet.provider]} ({wallet.role === 'primary' ? 'principal' : 'secundária'})
                  </label>
                ))}
              </div>
            ) : (
              <p>
                Você ainda não tem carteiras.{' '}
                <Link to="/account/wallets" className="underline">
                  Adicionar carteira
                </Link>
              </p>
            )}
            {errors.walletId ? (
              <p id="wallet-error" className="text-xs text-coral">
                {errors.walletId.message}
              </p>
            ) : null}

            <label htmlFor="checkout-network" className="text-sm">
              Rede
            </label>
            <select id="checkout-network" className="h-10 rounded-sm border bg-transparent px-2 text-sm" {...form.register('network')}>
              {(selectedWallet?.networks ?? (Object.keys(NETWORK_LABELS) as Network[])).map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABELS[n]}
                </option>
              ))}
            </select>
          </fieldset>

          <WalletConnectionPanel
            walletLabel={selectedWallet?.label ?? null}
            state={connection.state}
            connected={walletConnected}
            onConnect={() => selectedWallet && void connection.connect(selectedWallet.id, network)}
            onDisconnect={connection.disconnect}
          />

          <FormError message={errors.root?.server?.message} />

          {result ? (
            <div role="alert" className="rounded-md border p-3 text-sm">
              <p>{result.message}</p>
            </div>
          ) : null}

          {reviewing ? (
            <div className="flex flex-col gap-2">
              {checkout.quoteChanged ? (
                <div role="alert" className="rounded-md border p-3 text-sm">
                  <p>Preço, disponibilidade, cupom ou taxas mudaram. Revise o novo total antes de confirmar.</p>
                  <Button type="button" variant="outline" className="mt-2" onClick={() => { checkout.acceptQuote(); setResult(null) }}>
                    Aceitar novos valores
                  </Button>
                </div>
              ) : checkout.block && BLOCK_MESSAGES[checkout.block] ? (
                <p className="text-sm">{BLOCK_MESSAGES[checkout.block]}</p>
              ) : null}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={checkout.backToForm} disabled={checkout.isSubmitting}>
                  Editar dados
                </Button>
                <Button
                  type="submit"
                  disabled={(checkout.block !== null && !checkout.pendingAttempt) || checkout.isSubmitting}
                  aria-busy={checkout.isSubmitting || undefined}
                >
                  {checkout.isSubmitting ? 'Confirmando…' : result?.tone === 'error' && checkout.pendingAttempt ? 'Tentar novamente' : 'Confirmar compra'}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="submit" disabled={!quote || checkout.quote.isUpdating}>
              Revisar pedido
            </Button>
          )}
        </form>

        <aside className="flex flex-col gap-4">
          <section aria-label="Seus NFTs" className="flex flex-col gap-2">
            <h2 className="font-semibold">Seus NFTs</h2>
            <ul className="flex flex-col gap-1 text-sm">
              {quote?.lines.map((line) => (
                <li key={`${line.nftId}-${line.editionId}`} className="flex justify-between gap-2">
                  <span>
                    {line.nftName} ({line.editionName}) × {line.quantity}
                  </span>
                  <span>{formatEth(line.lineTotal, { maxDecimals: 6 })}</span>
                </li>
              ))}
            </ul>
          </section>
          <QuoteSummary quote={quote} updating={checkout.quote.isUpdating} />
        </aside>
      </div>
    </div>
  )
}

function WalletConnectionPanel({
  walletLabel,
  state,
  connected,
  onConnect,
  onDisconnect,
}: {
  walletLabel: string | null
  state: ReturnType<typeof useWalletConnection>['state']
  connected: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const status = connected
    ? `Carteira ${walletLabel} conectada.`
    : state.status === 'connecting'
      ? 'Aguardando aprovação na carteira…'
      : state.status === 'rejected' || state.status === 'error'
        ? `Conexão não concluída: ${state.message}`
        : 'Carteira desconectada.'
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
      <p role="status" className="flex-1">
        {status}
      </p>
      {connected ? (
        <Button type="button" variant="secondary" size="sm" onClick={onDisconnect}>
          Desconectar carteira
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={onConnect} disabled={!walletLabel || state.status === 'connecting'}>
          Conectar carteira
        </Button>
      )}
    </div>
  )
}
