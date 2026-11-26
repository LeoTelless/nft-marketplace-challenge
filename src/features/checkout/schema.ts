import { z } from 'zod'
import { collectorSchema, networkSchema, type Collector, type Network } from '@/contracts'

/** Optional text input: empty string allowed, otherwise validated like the contract field. */
function optionalField(schema: z.ZodType<string | undefined>) {
  return z.string().superRefine((value, ctx) => {
    if (value.trim() === '') return
    const result = schema.safeParse(value)
    if (!result.success) ctx.addIssue({ code: 'custom', message: result.error.issues[0]?.message ?? 'Valor inválido' })
  })
}

/** Checkout form ("Perfil do colecionador" + wallet and network), as react-hook-form values. */
export const checkoutFormSchema = z.object({
  collector: z.object({
    displayName: collectorSchema.shape.displayName,
    username: collectorSchema.shape.username,
    profileName: collectorSchema.shape.profileName,
    email: collectorSchema.shape.email,
    ensName: optionalField(collectorSchema.shape.ensName),
    referralCode: optionalField(collectorSchema.shape.referralCode),
    note: optionalField(collectorSchema.shape.note),
  }),
  walletId: z.string().min(1, 'Selecione uma carteira'),
  network: networkSchema,
})
export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>

/** Field paths the API may report errors on (`fieldErrors`), for `applyApiErrors`. */
export const CHECKOUT_FIELDS = [
  'collector.displayName',
  'collector.username',
  'collector.profileName',
  'collector.email',
  'collector.ensName',
  'collector.referralCode',
  'collector.note',
  'walletId',
  'network',
] as const

export function emptyCheckoutValues(defaults: { email?: string; name?: string; walletId?: string; network?: Network } = {}): CheckoutFormValues {
  return {
    collector: {
      displayName: defaults.name ?? '',
      username: '',
      profileName: defaults.name ?? '',
      email: defaults.email ?? '',
      ensName: '',
      referralCode: '',
      note: '',
    },
    walletId: defaults.walletId ?? '',
    network: defaults.network ?? 'ethereum',
  }
}

/** Form values → contract `Collector` (empty optional fields omitted). */
export function toCollector(values: CheckoutFormValues['collector']): Collector {
  const optional = (value: string) => (value.trim() === '' ? undefined : value.trim())
  return {
    displayName: values.displayName.trim(),
    username: values.username.trim(),
    profileName: values.profileName.trim(),
    email: values.email.trim(),
    ensName: optional(values.ensName),
    referralCode: optional(values.referralCode),
    note: optional(values.note),
  }
}
