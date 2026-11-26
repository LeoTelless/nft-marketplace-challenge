import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { CircleCheck, Loader2, PlugZap, ShoppingCart, Unplug } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import type { Quote, Wallet } from '@/contracts'
import { useCurrentUser } from '@/features/auth/session'
import { cartItemImage } from '@/features/cart/format'
import { CouponForm, SummaryRows } from '@/features/cart/components/summary'
import { useCart } from '@/features/cart/use-cart'
import { useCartChangeNotices } from '@/features/cart/use-cart-change-notices'
import { editionLabel, tokenLabel } from '@/features/nft/editions'
import { useWalletConnection } from '@/features/wallets/use-wallet-connection'
import { PROVIDER_LABELS, useWallets } from '@/features/wallets/use-wallets'
import { NETWORK_LABELS, shortAddress } from '@/features/wallets/format'
import { ProviderMark } from '@/features/wallets/wallet-display'
import { FormAlert, SelectField, TextField } from '@/shared/flow-ui/fields'
import { MARKET_CRUMBS } from '@/shared/flow-ui/crumbs'
import { Breadcrumb, MobileScreenHeader } from '@/shared/flow-ui/page-chrome'
import { StatusPage } from '@/shared/layout/status-page'
import { formatEth } from '@/shared/lib/eth'
import { applyApiErrors } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { NftImage } from '@/shared/ui/nft-image'
import { Skeleton } from '@/shared/ui/skeleton'
import { CHECKOUT_FIELDS, checkoutFormSchema, emptyCheckoutValues, type CheckoutFormValues } from '../schema'
import { checkoutDraft, useCheckout, type CheckoutOutcome, type ConfirmBlock } from '../use-checkout'

const eth = (value: string) => formatEth(value, { maxDecimals: 6 })

const BLOCK_MESSAGES: Partial<Record<ConfirmBlock, string>> = {
  quote_updating: 'Atualizando os valores do pedido…',
  quote_issues: 'Há itens indisponíveis no carrinho. Ajuste o carrinho para continuar.',
  wallet_disconnected: 'A carteira foi desconectada. Conecte-a novamente para confirmar.',
  empty_cart: 'Seu carrinho está vazio.',
}

type Result = { tone: 'error' | 'warning'; message: string } | null

/** Pagamento: collector form, wallet/network with simulated connection, summary and review. */
export function CheckoutPage() {
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
  const walletId = useWatch({ control: form.control, name: 'walletId' })
  const network = useWatch({ control: form.control, name: 'network' })
  const walletConnected = connection.isConnectedTo(walletId, network)
  const checkout = useCheckout({ network, walletConnected })
  const [result, setResult] = useState<Result>(null)

  // Draft saved on every change: survives refresh and session expiry (resumed after login).
  useEffect(() => {
    if (!user) return
    return form.subscribe({ formState: { values: true }, callback: ({ values }) => checkoutDraft.set(user.id, values) })
  }, [form, user])

  // Default to the primary wallet; keep the network among the ones the wallet supports.
  const walletList = wallets.data?.items ?? []
  const selectedWallet = walletList.find((w) => w.id === walletId) ?? null
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
      form.setError('walletId', { type: 'manual', message: 'Conecte a carteira selecionada para continuar.' }, { shouldFocus: true })
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
      <div className="container-page pt-4 md:pt-8">
        <MobileScreenHeader title="Pagamento com carteira" fallback="/cart" />
        <StatusPage
          icon={ShoppingCart}
          title="Seu carrinho está vazio."
          actions={
            <Link to="/" hash="catalogo" className={buttonVariants()}>
              Continuar explorando
            </Link>
          }
        >
          <p>Adicione NFTs ao carrinho para finalizar uma compra.</p>
        </StatusPage>
      </div>
    )
  }

  const quote = checkout.quote.data
  const errors = form.formState.errors

  return (
    <div className="container-page pt-4 pb-40 md:pt-8 md:pb-0">
      <Breadcrumb items={[...MARKET_CRUMBS, { label: 'Pagamento' }]} />
      <MobileScreenHeader title="Pagamento com carteira" fallback="/cart" />
      <h1 className="sr-only max-md:hidden">Pagamento</h1>

      {checkout.pendingAttempt ? (
        <FormAlert message="Há uma compra enviada sem confirmação do servidor. Verifique antes de comprar de novo: a mesma compra será recuperada, sem cobrança duplicada.">
          <Button size="sm" className="mt-2" onClick={() => void onRecover()} disabled={checkout.isSubmitting}>
            Verificar compra em andamento
          </Button>
        </FormAlert>
      ) : null}

      <form
        noValidate
        onSubmit={onReview}
        aria-label="Pagamento"
        className="mt-6 flex flex-col gap-8 md:mt-8 lg:flex-row lg:gap-8"
      >
        {/* Collector profile */}
        <section aria-labelledby="collector-title" className="flex min-w-0 flex-1 flex-col gap-3 lg:max-w-[763px]">
          <h2 id="collector-title" className="text-[17px] leading-4 font-bold">
            Perfil do colecionador
          </h2>
          <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            <TextField label="Nome de exibição" required autoComplete="name" error={errors.collector?.displayName?.message} {...form.register('collector.displayName')} />
            <TextField label="Nome de usuário" required autoComplete="username" error={errors.collector?.username?.message} {...form.register('collector.username')} />
            <SelectField label="Rede" required error={errors.network?.message} {...form.register('network')}>
              {(selectedWallet?.networks ?? (Object.keys(NETWORK_LABELS) as Array<keyof typeof NETWORK_LABELS>)).map((n) => (
                <option key={n} value={n}>
                  {NETWORK_LABELS[n]}
                </option>
              ))}
            </SelectField>
            <TextField label="Nome do perfil" required error={errors.collector?.profileName?.message} {...form.register('collector.profileName')} />
            <TextField
              label="Endereço da carteira"
              readOnly
              value={selectedWallet?.address ?? ''}
              placeholder="Endereço 0x da carteira"
              hint="Preenchido pela carteira selecionada."
            />
            <EnsField form={form} />
            <TextField
              label="Tipo de carteira"
              readOnly
              value={selectedWallet ? PROVIDER_LABELS[selectedWallet.provider] : ''}
              placeholder="Selecione uma carteira"
            />
            <TextField label="Código de indicação (opcional)" autoComplete="off" error={errors.collector?.referralCode?.message} {...form.register('collector.referralCode')} />
            <TextField label="E-mail" type="email" required autoComplete="email" error={errors.collector?.email?.message} {...form.register('collector.email')} />
          </div>

          <UseOtherWallet wallets={walletList} selected={selectedWallet} onSelect={(id) => form.setValue('walletId', id, { shouldDirty: true })} />

          <div className="mt-3 flex flex-col gap-2.5 md:max-w-[350px]">
            <label htmlFor="collector-note" className="text-[15px] leading-[15px]">
              Observação do colecionador (opcional)
            </label>
            <textarea
              id="collector-note"
              rows={6}
              aria-invalid={errors.collector?.note ? true : undefined}
              aria-describedby={errors.collector?.note ? 'collector-note-error' : undefined}
              className="min-h-[152px] rounded-sm border border-line bg-surface-dark p-3 text-sm text-foreground outline-hidden placeholder:text-text-muted hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent aria-invalid:border-coral"
              {...form.register('collector.note')}
            />
            {errors.collector?.note ? (
              <p id="collector-note-error" className="text-[13px] text-coral">
                {errors.collector.note.message}
              </p>
            ) : null}
          </div>
        </section>

        {/* Items, summary, wallet */}
        <div className="flex flex-col gap-8 lg:w-[405px] lg:shrink-0 lg:gap-3">
          <section aria-labelledby="items-title" className="flex flex-col gap-3">
            <h2 id="items-title" className="text-[17px] leading-4 font-bold">
              Seus NFTs
            </h2>
            <div>
              <div aria-hidden="true" className="flex justify-between border-b border-brand/30 pb-3 text-base leading-4">
                <span className="font-bold">NFTs</span>
                <span className="font-medium">Subtotal</span>
              </div>
              <QuoteLines quote={quote} />
            </div>
            <CouponToggle network={network} />
            <section aria-label="Resumo do pedido" className="border-b border-brand/30 pb-3">
              <SummaryRows quote={quote} updating={checkout.quote.isUpdating} />
            </section>
          </section>

          <section aria-labelledby="wallet-title" className="flex flex-col gap-5 lg:mt-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="wallet-title" className="text-[17px] leading-4 font-bold">
                Carteira e rede
              </h2>
              <Link to="/account/wallets" className="text-[15px] font-bold text-brand-accent underline-offset-4 hover:underline">
                Trocar carteira
              </Link>
            </div>
            <WalletChoices
              wallets={walletList}
              loading={wallets.isPending}
              selectedId={walletId}
              network={network}
              error={errors.walletId?.message}
              onSelect={(id) => form.setValue('walletId', id, { shouldDirty: true })}
            />
            <WalletConnectionPanel
              wallet={selectedWallet}
              network={network}
              state={connection.state}
              connected={walletConnected}
              onConnect={() => selectedWallet && void connection.connect(selectedWallet.id, network)}
              onDisconnect={connection.disconnect}
            />
            {result && checkout.step === 'form' ? <FormAlert message={result.message} tone={result.tone} /> : null}
            <div className="flex flex-col gap-3 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:rounded-t-[40px] max-md:bg-surface max-md:px-6 max-md:pt-5 max-md:pb-[max(env(safe-area-inset-bottom),24px)] max-md:shadow-bar">
              <p className="flex items-baseline justify-end gap-6 text-lg font-bold md:hidden">
                Total:
                <span className="text-[22px] text-brand-accent">{quote ? eth(quote.total) : '—'}</span>
              </p>
              <Button
                type="submit"
                disabled={!quote || checkout.quote.isUpdating}
                className="h-[60px] w-full rounded-full text-base font-bold md:h-[45px] md:rounded-sm md:text-[15px]"
              >
                Confirmar compra
              </Button>
            </div>
          </section>
        </div>
      </form>

      <ReviewDialog
        open={checkout.step === 'review'}
        onClose={() => {
          checkout.backToForm()
          setResult(null)
        }}
        quote={quote}
        updating={checkout.quote.isUpdating}
        values={form.getValues()}
        wallet={selectedWallet}
        quoteChanged={checkout.quoteChanged}
        onAcceptQuote={() => {
          checkout.acceptQuote()
          setResult(null)
        }}
        block={checkout.block}
        pendingAttempt={Boolean(checkout.pendingAttempt)}
        submitting={checkout.isSubmitting}
        result={result}
        onConfirm={() => void onConfirm()}
      />
    </div>
  )
}

function EnsField({ form }: { form: UseFormReturn<CheckoutFormValues> }) {
  const id = useId()
  const error = form.formState.errors.collector?.ensName?.message
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <label htmlFor={id} className="flex h-[29px] items-center text-[15px] leading-[15px]">
        Nome ENS (opcional)
      </label>
      <div className="flex gap-3">
        <input
          id={id}
          placeholder="ENS da carteira"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-suffix`}
          className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-surface-dark px-3 text-sm text-foreground outline-hidden placeholder:text-text-muted hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent aria-invalid:border-coral"
          {...form.register('collector.ensName')}
        />
        <span id={`${id}-suffix`} className="grid h-10 w-[78px] place-content-center rounded-sm border border-line text-base">
          .eth
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-coral">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/** "Usar outra carteira?": switches between the primary and the secondary registered wallet. */
function UseOtherWallet({ wallets, selected, onSelect }: { wallets: Wallet[]; selected: Wallet | null; onSelect: (id: string) => void }) {
  const secondary = wallets.find((w) => w.role === 'secondary')
  const primary = wallets.find((w) => w.role === 'primary')
  const checked = selected?.role === 'secondary'
  return (
    <label className={cn('mt-3 flex w-fit items-center gap-2 text-[15px] leading-5', !secondary && 'opacity-60')}>
      <input
        type="checkbox"
        className="size-[15px] cursor-pointer appearance-none rounded-full border-2 border-brand checked:bg-brand checked:shadow-[inset_0_0_0_2px_var(--kurio-ink)] disabled:cursor-not-allowed"
        checked={checked}
        disabled={!secondary}
        onChange={(event) => {
          const target = event.target.checked ? secondary : primary
          if (target) onSelect(target.id)
        }}
      />
      Usar outra carteira?
      {!secondary ? <span className="text-xs text-text-muted">(cadastre uma carteira secundária)</span> : null}
    </label>
  )
}

function QuoteLines({ quote }: { quote: Quote | undefined }) {
  if (!quote) {
    return (
      <div aria-busy="true" aria-label="Carregando itens" className="mt-3 flex flex-col gap-3">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-[70px] w-full rounded-none" />
        ))}
      </div>
    )
  }
  return (
    <ul className="mt-3 flex flex-col gap-3">
      {quote.lines.map((line) => (
        <li key={`${line.nftId}-${line.editionId}`} className="flex min-h-[70px] flex-wrap items-center gap-x-2 gap-y-1 bg-surface py-1 pr-4 pl-1">
          <div className="size-[66px] shrink-0 overflow-hidden rounded-[10px]">
            <NftImage image={cartItemImage(line)} sizes="70px" />
          </div>
          <div className="flex min-w-[130px] flex-1 flex-col gap-1.5">
            <span className="line-clamp-2 text-base leading-[18px] font-bold break-words">{line.nftName}</span>
            <span className="text-sm leading-4 text-text-muted">
              {editionLabel({ name: line.editionName })} · ID {tokenLabel(line.nftId)}
            </span>
          </div>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-sm text-text-secondary">
              <span className="sr-only">Quantidade: </span>(x {line.quantity})
            </span>
            <span className="min-w-[88px] text-right text-lg leading-4 font-bold text-brand-accent">{eth(line.lineTotal)}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function CouponToggle({ network }: { network: CheckoutFormValues['network'] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="cursor-pointer text-center text-sm leading-4 text-foreground underline-offset-4 hover:text-brand-accent hover:underline"
      >
        Tem um código promocional? Aplique aqui
      </button>
      {open ? <CouponForm network={network} compact /> : null}
    </div>
  )
}

function WalletChoices({
  wallets,
  loading,
  selectedId,
  network,
  error,
  onSelect,
}: {
  wallets: Wallet[]
  loading: boolean
  selectedId: string
  network: CheckoutFormValues['network']
  error?: string
  onSelect: (id: string) => void
}) {
  if (loading) {
    return (
      <div aria-busy="true" aria-label="Carregando carteiras" className="flex flex-col gap-4">
        <Skeleton className="h-[45px] w-full" />
        <Skeleton className="h-[45px] w-full" />
      </div>
    )
  }
  if (!wallets.length) {
    return (
      <FormAlert tone="warning" message="Você ainda não tem carteiras cadastradas.">
        <Link to="/account/wallets" className="mt-1 inline-block font-bold text-brand-accent underline">
          Adicionar carteira
        </Link>
      </FormAlert>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Carteira" aria-describedby={error ? 'wallet-error' : undefined} className="flex flex-col gap-4">
        {wallets.map((wallet) => {
          const checked = wallet.id === selectedId
          return (
            <label
              key={wallet.id}
              className={cn(
                'flex cursor-pointer items-center gap-4 rounded-[15px] border bg-surface px-4 py-4 transition-colors md:min-h-[45px] md:rounded-none md:bg-transparent md:py-2',
                checked ? 'border-brand' : 'border-line hover:border-line-soft',
              )}
            >
              <input
                type="radio"
                name="checkout-wallet"
                value={wallet.id}
                checked={checked}
                onChange={() => onSelect(wallet.id)}
                className="size-5 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-brand/70 checked:border-brand checked:bg-brand checked:shadow-[inset_0_0_0_3px_var(--kurio-surface)]"
              />
              <ProviderMark provider={wallet.provider} className="max-md:hidden" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] leading-5 font-bold md:font-normal">
                  {wallet.label} <span className="font-normal text-text-muted">— {PROVIDER_LABELS[wallet.provider]}</span>
                </span>
                <span className="text-sm text-text-secondary">
                  {shortAddress(wallet.address)} · {wallet.role === 'primary' ? 'principal' : 'secundária'}
                  {checked ? ` · Rede ${NETWORK_LABELS[network]}` : ''}
                </span>
              </span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p id="wallet-error" className="text-[13px] text-coral">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function WalletConnectionPanel({
  wallet,
  network,
  state,
  connected,
  onConnect,
  onDisconnect,
}: {
  wallet: Wallet | null
  network: CheckoutFormValues['network']
  state: ReturnType<typeof useWalletConnection>['state']
  connected: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const status = connected
    ? `Carteira ${wallet?.label} conectada.`
    : state.status === 'connecting'
      ? 'Aguardando aprovação na carteira…'
      : state.status === 'rejected' || state.status === 'error'
        ? `Conexão não concluída: ${state.message}`
        : 'Carteira desconectada.'
  const Icon = connected ? CircleCheck : state.status === 'connecting' ? Loader2 : Unplug
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-line bg-surface px-4 py-3 text-sm sm:flex-row sm:items-center">
      <p role="status" className="flex min-w-0 flex-1 items-start gap-2">
        <Icon
          aria-hidden="true"
          className={cn('mt-0.5 size-4 shrink-0', connected ? 'text-success' : state.status === 'connecting' ? 'animate-spin text-brand-accent' : 'text-text-muted')}
        />
        <span>
          {status}
          {connected ? <span className="text-text-muted"> Rede {NETWORK_LABELS[network]}.</span> : null}
        </span>
      </p>
      {connected ? (
        <Button type="button" variant="secondary" size="sm" onClick={onDisconnect}>
          Desconectar carteira
        </Button>
      ) : (
        <Button type="button" size="sm" onClick={onConnect} disabled={!wallet || state.status === 'connecting'}>
          <PlugZap aria-hidden="true" className="size-4" /> Conectar carteira
        </Button>
      )}
    </div>
  )
}

function ReviewDialog({
  open,
  onClose,
  quote,
  updating,
  values,
  wallet,
  quoteChanged,
  onAcceptQuote,
  block,
  pendingAttempt,
  submitting,
  result,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  quote: Quote | undefined
  updating: boolean
  values: CheckoutFormValues
  wallet: Wallet | null
  quoteChanged: boolean
  onAcceptQuote: () => void
  block: ConfirmBlock | null
  pendingAttempt: boolean
  submitting: boolean
  result: Result
  onConfirm: () => void
}) {
  const blockMessage = !quoteChanged && block && block !== 'not_reviewed' ? BLOCK_MESSAGES[block] : undefined
  return (
    <Dialog open={open} onOpenChange={(next) => (next || submitting ? undefined : onClose())}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-none border-0 border-b-[10px] border-b-brand bg-surface px-6 pt-10 pb-8 sm:max-w-[578px] md:px-11">
        <div className="flex flex-col gap-2 text-center">
          <DialogTitle className="text-xl leading-6">Revise seu pedido</DialogTitle>
          <DialogDescription>Confira os itens, os valores da cotação e a carteira antes de confirmar.</DialogDescription>
        </div>

        <dl className="grid grid-cols-2 gap-3 border-y border-brand py-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-bold text-text-secondary">Carteira</dt>
            <dd className="break-words">{wallet ? `${wallet.label} (${shortAddress(wallet.address)})` : '—'}</dd>
          </div>
          <div>
            <dt className="font-bold text-text-secondary">Rede</dt>
            <dd>{NETWORK_LABELS[values.network]}</dd>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <dt className="font-bold text-text-secondary">Colecionador</dt>
            <dd className="break-words">
              {values.collector.displayName} (@{values.collector.username})
            </dd>
          </div>
        </dl>

        <section aria-label="Itens do pedido">
          <QuoteLines quote={quote} />
        </section>
        <section aria-label="Resumo da revisão">
          <SummaryRows quote={quote} updating={updating} />
        </section>

        {quoteChanged ? (
          <FormAlert tone="warning" message="Preço, disponibilidade, cupom ou taxas mudaram. Revise o novo total antes de confirmar.">
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={onAcceptQuote}>
              Aceitar novos valores
            </Button>
          </FormAlert>
        ) : null}
        {blockMessage ? <p className="text-sm text-text-secondary">{blockMessage}</p> : null}
        {result ? <FormAlert tone={result.tone} message={result.message} /> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Editar dados
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={(block !== null && !pendingAttempt) || submitting}
            aria-busy={submitting || undefined}
            className="sm:min-w-[200px]"
          >
            {submitting ? 'Confirmando…' : result?.tone === 'error' && pendingAttempt ? 'Tentar novamente' : 'Confirmar compra'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
