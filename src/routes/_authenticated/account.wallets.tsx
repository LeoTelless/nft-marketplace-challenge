import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { networkSchema, walletProviderSchema, type Wallet } from '@/contracts'
import { FormError, TextField } from '@/features/auth/form-field'
import {
  PROVIDER_LABELS,
  WALLET_FIELDS,
  walletFormSchema,
  useCreateWallet,
  useUpdateWallet,
  useWallets,
  type WalletFormValues,
} from '@/features/wallets/use-wallets'
import { apiErrorMessage, applyApiErrors } from '@/shared/lib/form-errors'
import { Button } from '@/shared/ui/button'

/** Provisional wallets screen (flow skeleton; the Figma layout comes in stage 2). */
export const Route = createFileRoute('/_authenticated/account/wallets')({
  head: () => ({ meta: [{ title: 'Carteiras | KURIO' }] }),
  component: WalletsPage,
})

function WalletsPage() {
  const wallets = useWallets()
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Carteiras</h1>
      <p className="text-sm">Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.</p>
      {wallets.isPending ? (
        <p aria-busy="true">Carregando carteiras…</p>
      ) : wallets.isError ? (
        <div role="alert">
          <p>{apiErrorMessage(wallets.error)}</p>
          <Button variant="secondary" onClick={() => void wallets.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <ul aria-label="Suas carteiras" className="flex flex-col gap-2">
            {wallets.data.items.map((wallet) => (
              <WalletRow key={wallet.id} wallet={wallet} />
            ))}
          </ul>
          {!wallets.data.secondary ? <p className="text-sm">Você ainda não adicionou uma carteira secundária.</p> : null}
          {wallets.data.items.length < 2 ? <WalletForm role={wallets.data.primary ? 'secondary' : 'primary'} /> : null}
        </>
      )}
    </div>
  )
}

function WalletRow({ wallet }: { wallet: Wallet }) {
  const update = useUpdateWallet()
  return (
    <li aria-label={wallet.label} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm">
      <div className="flex-1">
        <p className="font-medium">
          {wallet.label} ({wallet.role === 'primary' ? 'Carteira principal' : 'Carteira secundária'})
        </p>
        <p className="break-all opacity-80">{wallet.address}</p>
        <p>
          {PROVIDER_LABELS[wallet.provider]} · {wallet.networks.join(', ')}
        </p>
      </div>
      {wallet.role === 'secondary' ? (
        <Button
          variant="outline"
          size="sm"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: wallet.id, role: 'primary' })}
        >
          Tornar principal
        </Button>
      ) : null}
    </li>
  )
}

function WalletForm({ role }: { role: Wallet['role'] }) {
  const create = useCreateWallet()
  const form = useForm<WalletFormValues>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: { label: '', address: '', provider: 'walletconnect', role, networks: ['ethereum'] },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values)
      form.reset()
    } catch (error) {
      applyApiErrors(error, form.setError, WALLET_FIELDS)
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Adicionar carteira" className="flex flex-col gap-3">
      <h2 className="font-semibold">Adicionar carteira {role === 'primary' ? 'principal' : 'secundária'}</h2>
      <TextField label="Apelido da carteira" required error={errors.label?.message} {...form.register('label')} />
      <TextField label="Endereço da carteira" required placeholder="Endereço 0x da carteira" error={errors.address?.message} {...form.register('address')} />
      <label htmlFor="wallet-provider" className="text-sm">
        Tipo de carteira
      </label>
      <select id="wallet-provider" className="h-10 rounded-sm border bg-transparent px-2 text-sm" {...form.register('provider')}>
        {walletProviderSchema.options.map((provider) => (
          <option key={provider} value={provider}>
            {PROVIDER_LABELS[provider]}
          </option>
        ))}
      </select>
      <fieldset className="flex flex-wrap gap-3 text-sm" aria-describedby={errors.networks ? 'networks-error' : undefined}>
        <legend>Redes</legend>
        {networkSchema.options.map((network) => (
          <label key={network} className="flex items-center gap-1">
            <input type="checkbox" value={network} {...form.register('networks')} />
            {network}
          </label>
        ))}
      </fieldset>
      {errors.networks ? (
        <p id="networks-error" className="text-xs text-coral">
          {errors.networks.message}
        </p>
      ) : null}
      {errors.role ? <p className="text-xs text-coral">{errors.role.message}</p> : null}
      <FormError message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting}>
        Salvar carteira
      </Button>
    </form>
  )
}
