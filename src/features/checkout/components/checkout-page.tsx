import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { CircleCheck, Loader2, PlugZap, ShoppingCart, Unplug } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { useForm, useWatch, type UseFormReturn } from 'react-hook-form'
import type { Quote, Wallet } from '@/contracts'
import { useCurrentUser } from '@/features/auth/session'
import { cartItemImage, exactEth } from '@/features/cart/format'
import { CouponForm, SummaryRows } from '@/features/cart/components/summary'
import { useCart } from '@/features/cart/use-cart'
import { useCartChangeNotices } from '@/features/cart/use-cart-change-notices'
import { editionLabel, tokenLabel } from '@/features/nft/editions'
import { useWalletConnection } from '@/features/wallets/use-wallet-connection'
import { PROVIDER_LABELS, useWallets } from '@/features/wallets/use-wallets'
import { NETWORK_LABELS, shortAddress } from '@/features/wallets/format'
import { FormAlert, SelectField, TextField } from '@/shared/flow-ui/fields'
import { MARKET_CRUMBS } from '@/shared/flow-ui/crumbs'
import { Breadcrumb, MobileScreenHeader } from '@/shared/flow-ui/page-chrome'
import { StatusPage } from '@/shared/layout/status-page'
import { isApiError } from '@/shared/api/api-error'
import { applyApiErrors } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import { Button, buttonVariants } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { NftImage } from '@/shared/ui/nft-image'
import { Skeleton } from '@/shared/ui/skeleton'
import { CHECKOUT_FIELDS, checkoutFormSchema, emptyCheckoutValues, type CheckoutFormValues } from '../schema'
import { checkoutDraft, useCheckout, type CheckoutOutcome, type ConfirmBlock } from '../use-checkout'

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

  // Focus after the review dialog closes: the first field the API rejected, else the button
  // that opened it ("Confirmar compra"). Radix would otherwise drop focus on <body>.
  const confirmButton = useRef<HTMLButtonElement>(null)
  const focusAfterClose = useRef<(typeof CHECKOUT_FIELDS)[number] | null>(null)
  const applyFieldErrors = (error: unknown) => {
    const applied = applyApiErrors(error, form.setError, CHECKOUT_FIELDS)
    if (applied && isApiError(error)) {
      focusAfterClose.current = CHECKOUT_FIELDS.find((field) => error.fieldErrors[field]?.length) ?? null
    }
    return applied
  }
  const restoreFocus = () => {
    const field = focusAfterClose.current
    focusAfterClose.current = null
    if (field && field !== 'walletId') form.setFocus(field)
    else confirmButton.current?.focus()
  }

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
        if (isApiError(outcome.error) && outcome.error.code === 'wallet_not_connected') {
          // The server has no connection for this wallet/network (declined, disconnected, new session).
          connection.markDisconnected()
          checkout.backToForm()
          focusAfterClose.current = 'walletId'
          form.setError('walletId', { type: 'server', message: outcome.message })
          setResult(null)
          return
        }
        if (applyFieldErrors(outcome.error)) checkout.backToForm()
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
  const onConfirm = () => form.handleSubmit(async (values) => handleOutcome(await checkout.confirm(values)))()
  // Re-sends the stored attempt as is (same key and body): no form validation needed.
  const onRecover = async () => handleOutcome(await checkout.confirm(form.getValues()))

  if (cart.isSuccess && cart.data.items.length === 0 && !checkout.pendingAttempt) {
    return (
      <div className="container-page min-h-dvh pt-8 max-md:[--page-gutter:1.75rem]">
        <MobileScreenHeader title="Pagamento com carteira" fallback="/cart" align="start" titleAs="p" />
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
    // Mobile: 32px top and 28px side margins of the frame; room for the fixed total bar.
    <div className="container-page min-h-dvh pt-8 pb-40 max-md:[--page-gutter:1.75rem] md:pb-0">
      <Breadcrumb items={[...MARKET_CRUMBS, { label: 'Pagamento' }]} />
      <MobileScreenHeader title="Pagamento com carteira" fallback="/cart" align="start" />
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
        className="mt-4 flex flex-col gap-8 md:mt-8 lg:flex-row lg:gap-8"
      >
        {/* Collector profile */}
        <section aria-labelledby="collector-title" className="flex min-w-0 flex-1 flex-col gap-3 max-md:order-2 lg:max-w-[763px]">
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
              required
              readOnly
              value={selectedWallet?.address ?? ''}
              placeholder="Endereço 0x da carteira"
              // The full address may not fit the field: available on hover (the field also scrolls).
              title={selectedWallet?.address ?? 'Preenchido pela carteira selecionada'}
            />
            <EnsField form={form} />
            <TextField
              label="Tipo de carteira"
              required
              readOnly
              value={selectedWallet ? PROVIDER_LABELS[selectedWallet.provider] : ''}
              placeholder="Selecione uma carteira"
            />
            <TextField label="Código de indicação (opcional)" autoComplete="off" error={errors.collector?.referralCode?.message} {...form.register('collector.referralCode')} />
            <TextField label="E-mail" type="email" required autoComplete="email" error={errors.collector?.email?.message} {...form.register('collector.email')} />
          </div>

          <UseOtherWallet wallets={walletList} selected={selectedWallet} onSelect={(id) => form.setValue('walletId', id, { shouldDirty: true })} />

          <div className="mt-3 flex flex-col gap-3 md:max-w-[350px]">
            <label htmlFor="collector-note" className="text-[15px] leading-[15px]">
              Observação do colecionador (opcional)
            </label>
            <textarea
              id="collector-note"
              rows={6}
              aria-invalid={errors.collector?.note ? true : undefined}
              aria-describedby={errors.collector?.note ? 'collector-note-error' : undefined}
              className="min-h-[152px] resize-none rounded-[3px] border border-line bg-transparent p-3 text-sm text-foreground outline-hidden placeholder:text-text-muted hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent aria-invalid:border-coral"
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
        {/* Below md the column dissolves so the frame order applies: wallet, collector, items. */}
        <div className="flex flex-col gap-8 max-md:contents lg:w-[405px] lg:shrink-0 lg:gap-3">
          <section aria-labelledby="items-title" className="flex flex-col gap-3 max-md:order-3">
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
            <section aria-label="Resumo do pedido">
              <SummaryRows quote={quote} updating={checkout.quote.isUpdating} variant="checkout" />
            </section>
          </section>

          <section aria-labelledby="wallet-title" className="flex flex-col gap-5 max-md:order-1 max-md:gap-4">
            {/* Mobile frame: title + "Trocar carteira"; desktop frame: centered title only. */}
            <div className="flex items-baseline justify-between gap-3 md:justify-center">
              <h2 id="wallet-title" className="text-base leading-4 font-bold md:text-[17px]">
                Carteira e rede
              </h2>
              <Link to="/account/wallets" className="text-sm leading-4 font-bold text-brand-accent underline-offset-4 hover:underline md:hidden">
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
            {/* Mobile: fixed bar with "Total:" 16/18px and the 60px gradient CTA (28px margins). */}
            <div className="flex flex-col gap-4 max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:rounded-t-[40px] max-md:bg-surface max-md:px-7 max-md:pt-6 max-md:pb-[max(env(safe-area-inset-bottom),32px)] max-md:shadow-bar md:mt-1">
              <p className="flex items-baseline justify-end gap-7 text-base leading-4 font-bold md:hidden">
                Total:
                <span className="text-lg leading-4 text-brand-accent">{quote ? exactEth(quote.total) : '—'}</span>
              </p>
              <Button
                ref={confirmButton}
                type="submit"
                disabled={!quote || checkout.quote.isUpdating}
                className="h-[60px] w-full rounded-full bg-linear-135 from-brand to-brand/80 text-[15px] font-bold hover:from-brand-accent hover:to-brand-accent md:h-[45px] md:rounded-[8px] md:bg-brand md:bg-none md:hover:bg-brand-accent"
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
        onRestoreFocus={restoreFocus}
      />
    </div>
  )
}

function EnsField({ form }: { form: UseFormReturn<CheckoutFormValues> }) {
  const id = useId()
  const error = form.formState.errors.collector?.ensName?.message
  return (
    <div className="flex min-w-0 flex-col">
      <label htmlFor={id} className="flex h-[29px] items-center text-[15px] leading-[15px]">
        Nome ENS (opcional)
      </label>
      <div className="flex gap-2.5">
        <input
          id={id}
          placeholder="seunome"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-suffix`}
          className="h-10 min-w-0 flex-1 rounded-[3px] border border-line bg-transparent px-3 text-sm text-foreground outline-hidden placeholder:text-text-muted hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent aria-invalid:border-coral"
          {...form.register('collector.ensName')}
        />
        <span id={`${id}-suffix`} className="grid h-10 w-[78px] place-content-center rounded-[3px] border border-line text-[15px]">
          .eth
        </span>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-coral">
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
        // Frame row: 70px, 4px left padding, 66px artwork with an 8px radius.
        <li key={`${line.nftId}-${line.editionId}`} className="flex min-h-[70px] items-center gap-2 bg-surface py-0.5 pr-4 pl-1">
          <div className="size-[66px] shrink-0 overflow-hidden rounded-[8px]">
            <NftImage image={cartItemImage(line)} sizes="70px" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="line-clamp-2 text-base leading-4 font-bold break-words">{line.nftName}</span>
            <span className="text-sm leading-4 text-text-muted">
              ID do token: {tokenLabel(line.nftId)}
              {/* The frame line only has the token; the edition is added when it is not the standard one. */}
              {line.editionName === 'Standard' ? null : ` · ${editionLabel({ name: line.editionName })}`}
            </span>
          </div>
          <span className="ml-auto flex flex-col items-end gap-1.5">
            <span className="text-right text-lg leading-4 font-bold whitespace-nowrap text-brand-accent">{exactEth(line.lineTotal)}</span>
            <span className="text-sm leading-4 text-text-secondary">
              <span className="sr-only">Quantidade: </span>(x {line.quantity})
            </span>
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
        {/* Same height as the wallet cards (two-line cards on mobile), so nothing below moves. */}
        <Skeleton className="h-[93px] w-full rounded-[14px] md:h-[45px] md:rounded-[3px]" />
        <Skeleton className="h-[93px] w-full rounded-[14px] md:h-[45px] md:rounded-[3px]" />
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
      <div role="radiogroup" aria-label="Carteira" aria-describedby={error ? 'wallet-error' : undefined} className="flex flex-col gap-5 md:gap-4">
        {wallets.map((wallet) => {
          const checked = wallet.id === selectedId
          return (
            <label
              key={wallet.id}
              className={cn(
                // Mobile: 93px card (14px radius, frame shadow, no border: the radio shows the
                // choice); desktop: 45px option with a 3px radius, orange border when selected.
                'flex min-h-[93px] cursor-pointer items-center gap-[19px] rounded-[14px] bg-surface px-[19px] py-3 shadow-[0_20px_20px_#0A060473] transition-colors md:min-h-[45px] md:gap-2.5 md:rounded-[3px] md:border md:bg-transparent md:px-3 md:py-2 md:shadow-none',
                checked ? 'md:border-brand' : 'md:border-line md:hover:border-line-soft',
              )}
            >
              <input
                type="radio"
                name="checkout-wallet"
                value={wallet.id}
                checked={checked}
                onChange={() => onSelect(wallet.id)}
                // 16px ring (1.2px) with a 10px dot, as in the frames.
                className="size-4 shrink-0 cursor-pointer appearance-none rounded-full border-[1.2px] border-line-soft checked:border-brand checked:bg-brand checked:shadow-[inset_0_0_0_2px_var(--kurio-surface)] md:checked:shadow-[inset_0_0_0_2px_var(--kurio-ink)]"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-3">
                <span className="text-base leading-4 font-bold md:text-[15px] md:leading-5 md:font-normal">
                  {wallet.label}
                  {/* The provider is visible on desktop only when the nickname does not already name it. */}
                  <span className={cn('sr-only md:font-normal md:text-text-muted', !namesProvider(wallet) && 'md:not-sr-only')}> — {PROVIDER_LABELS[wallet.provider]}</span>
                </span>
                <span className="text-sm leading-[22px] text-text-secondary md:shrink-0 md:text-[13px] md:leading-5 md:text-text-muted">
                  {shortAddress(wallet.address)}
                  <span className="md:sr-only">
                    {' '}
                    · {wallet.role === 'primary' ? 'principal' : 'secundária'}
                    {checked ? ` · Rede ${NETWORK_LABELS[network]}` : ''}
                  </span>
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

function namesProvider(wallet: Wallet) {
  const brand = PROVIDER_LABELS[wallet.provider].split(' ')[0].toLowerCase()
  return wallet.label.toLowerCase().includes(brand)
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
  onRestoreFocus,
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
  onRestoreFocus: () => void
}) {
  const blockMessage = !quoteChanged && block && block !== 'not_reviewed' ? BLOCK_MESSAGES[block] : undefined
  return (
    <Dialog open={open} onOpenChange={(next) => (next || submitting ? undefined : onClose())}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          onRestoreFocus()
        }}
        className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-none border-0 border-b-[10px] border-b-brand bg-surface px-6 pt-10 pb-8 sm:max-w-[578px] md:px-11"
      >
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
