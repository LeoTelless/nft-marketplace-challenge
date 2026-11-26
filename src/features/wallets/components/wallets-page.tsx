import { zodResolver } from '@hookform/resolvers/zod'
import { Check, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { networkSchema, walletProviderSchema, type Wallet, type WalletRole } from '@/contracts'
import { AccountHeading } from '@/features/account/account-layout'
import { FormAlert, SelectField, TextField } from '@/shared/flow-ui/fields'
import { StatusPage } from '@/shared/layout/status-page'
import { apiErrorMessage, applyApiErrors } from '@/shared/lib/form-errors'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { PROVIDER_LABELS, WALLET_FIELDS, walletFormSchema, useCreateWallet, useUpdateWallet, useWallets, type WalletFormValues } from '../use-wallets'
import { NETWORK_LABELS } from '../format'

/** Carteiras: primary and secondary wallet (create, edit, promote), used at checkout. */
export function WalletsPage() {
  const wallets = useWallets()
  const [addingSecondary, setAddingSecondary] = useState(false)

  if (wallets.isPending) return <WalletsSkeleton />
  if (wallets.isError) {
    return (
      <StatusPage icon={TriangleAlert} tone="error" title="Não foi possível carregar as carteiras" actions={<Button onClick={() => void wallets.refetch()}>Tentar novamente</Button>}>
        <p role="alert">{apiErrorMessage(wallets.error)}</p>
      </StatusPage>
    )
  }

  const { primary, secondary } = wallets.data
  return (
    // Frame: 32px between the blocks (heading, fields, Salvar, secondary wallet).
    <div className="flex flex-col gap-8">
      <h1 className="sr-only">Carteiras</h1>
      <section aria-labelledby="primary-title" className="flex flex-col gap-8">
        <AccountHeading
          id="primary-title"
          as="h2"
          title="Carteira principal"
          description="Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados."
          action={
            primary && !secondary && !addingSecondary ? (
              <Button variant="link" className={ADD_LINK} onClick={() => setAddingSecondary(true)}>
                Adicionar
              </Button>
            ) : null
          }
        />
        <WalletEditor key={primary?.id ?? 'new-primary'} wallet={primary} role="primary" />
      </section>

      <section aria-labelledby="secondary-title" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-3">
            <h2 id="secondary-title" className="text-lg leading-5 font-bold md:text-[17px] md:leading-4">
              Carteira secundária
            </h2>
            {!secondary && !addingSecondary ? (
              <p className="text-[15px] leading-5 text-text-secondary md:text-sm md:leading-[15px]">Você ainda não adicionou uma carteira secundária.</p>
            ) : null}
          </div>
          {!secondary && !addingSecondary && primary ? (
            <Button variant="link" className={ADD_LINK} onClick={() => setAddingSecondary(true)}>
              Adicionar<span className="sr-only"> carteira secundária</span>
            </Button>
          ) : null}
        </div>
        {secondary ? <PromoteButton wallet={secondary} /> : null}
        {secondary || addingSecondary ? (
          <WalletEditor key={secondary?.id ?? 'new-secondary'} wallet={secondary} role="secondary" onCancel={secondary ? undefined : () => setAddingSecondary(false)} />
        ) : null}
        {!primary ? <p className="text-sm text-text-muted">Cadastre a carteira principal antes da secundária.</p> : null}
      </section>
    </div>
  )
}

/** "Adicionar" of the frame: 500/16 text link on the title line (no button box). */
const ADD_LINK = 'h-4 px-0 text-base leading-4 font-medium'

/** Loading state with the final box sizes (also the pending screen of the private route). */
export function WalletsSkeleton() {
  return (
    // Heading (39px), the two 65px field rows and the button, as the loaded form.
    <div aria-busy="true" aria-label="Carregando carteiras" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-[15px] w-full max-w-xl" />
      </div>
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[65px] w-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full md:w-[131px]" />
    </div>
  )
}

function PromoteButton({ wallet }: { wallet: Wallet }) {
  const update = useUpdateWallet()
  return (
    <Button variant="outline" className="w-fit" disabled={update.isPending} onClick={() => update.mutate({ id: wallet.id, role: 'primary' })}>
      {update.isPending ? (
        'Atualizando…'
      ) : (
        <>
          Tornar principal<span className="sr-only">: {wallet.label}</span>
        </>
      )}
    </Button>
  )
}

function defaults(wallet: Wallet | null, role: WalletRole): WalletFormValues {
  return wallet
    ? { label: wallet.label, address: wallet.address, provider: wallet.provider, role, networks: wallet.networks }
    : { label: '', address: '', provider: 'walletconnect', role, networks: ['ethereum'] }
}

const TIGHT = 'gap-0 [&>:nth-child(2)]:-mt-1'

function WalletEditor({ wallet, role, onCancel }: { wallet: Wallet | null; role: WalletRole; onCancel?: () => void }) {
  const create = useCreateWallet()
  const update = useUpdateWallet()
  const form = useForm<WalletFormValues>({ resolver: zodResolver(walletFormSchema), defaultValues: defaults(wallet, role) })
  const { errors, isSubmitting, isDirty } = form.formState
  const networksId = useId()
  // "Salvar carteira" keeps the frame look at rest (never dimmed): with nothing changed, saving
  // answers with a note instead of a disabled button.
  const [nothingToSaveClicked, setNothingToSave] = useState(false)
  const nothingToSave = nothingToSaveClicked && !isDirty

  useEffect(() => {
    form.reset(defaults(wallet, role), { keepDirtyValues: true })
  }, [wallet, role, form])

  const onSubmit = form.handleSubmit(async (values) => {
    if (wallet && !isDirty) {
      setNothingToSave(true)
      return
    }
    try {
      if (wallet) {
        await update.mutateAsync({ id: wallet.id, label: values.label, address: values.address, provider: values.provider, networks: values.networks })
        form.reset(values)
      } else {
        await create.mutateAsync(values)
        onCancel?.()
      }
    } catch (error) {
      applyApiErrors(error, form.setError, WALLET_FIELDS)
    }
  })

  const title = role === 'primary' ? 'principal' : 'secundária'
  return (
    <form noValidate onSubmit={onSubmit} aria-label={`${wallet ? 'Editar' : 'Adicionar'} carteira ${title}`} className="flex flex-col gap-8">
      {/* Frame rows: 29px label box overlapping the input by 4px (input 25px below the top). */}
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <TextField className={TIGHT} label="Apelido da carteira" required error={errors.label?.message} {...form.register('label')} />
        <SelectField className={TIGHT} label="Tipo de carteira" required error={errors.provider?.message} {...form.register('provider')}>
          {walletProviderSchema.options.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABELS[provider]}
            </option>
          ))}
        </SelectField>
        <TextField
          className={TIGHT}
          label="Endereço da carteira"
          required
          placeholder="Endereço 0x da carteira"
          autoComplete="off"
          spellCheck={false}
          error={errors.address?.message}
          {...form.register('address')}
        />
        <fieldset aria-describedby={errors.networks ? `${networksId}-error` : undefined} className={cn('flex flex-col', TIGHT)}>
          <legend className="flex h-[29px] items-center text-[15px] leading-[15px]">
            Redes<span aria-hidden="true" className="ml-0.5 text-[22px] text-coral">*</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {networkSchema.options.map((network) => (
              <label key={network} className="relative">
                <input type="checkbox" value={network} className="peer sr-only" {...form.register('networks')} />
                <span
                  className={cn(
                    'inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm border border-line bg-surface-dark px-3 text-sm',
                    'peer-checked:border-brand peer-checked:bg-brand/15 peer-checked:[&_.check]:opacity-100 peer-checked:text-brand-accent peer-focus-visible:outline-2 peer-focus-visible:outline-solid focus-visible:outline-solid peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-accent',
                  )}
                >
                  <span aria-hidden="true" className="grid size-4 place-content-center rounded-[3px] border border-current">
                    <Check className="check size-3 opacity-0" />
                  </span>
                  {NETWORK_LABELS[network]}
                </span>
              </label>
            ))}
          </div>
          {errors.networks ? (
            <p id={`${networksId}-error`} className="text-[13px] text-coral">
              {errors.networks.message ?? 'Selecione ao menos uma rede'}
            </p>
          ) : null}
        </fieldset>
      </div>
      {errors.role ? <FormAlert message={errors.role.message} /> : null}
      <FormAlert message={errors.root?.server?.message} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className="h-10 w-full rounded-[3px] px-0 font-bold md:w-[131px]">
          {isSubmitting ? 'Salvando…' : 'Salvar carteira'}
        </Button>
        {nothingToSave ? (
          <p role="status" className="text-sm text-text-muted">
            Nenhuma alteração para salvar.
          </p>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  )
}
