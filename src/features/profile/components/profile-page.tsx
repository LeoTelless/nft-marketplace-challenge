import { zodResolver } from '@hookform/resolvers/zod'
import { ImageUp, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import type { Profile, Wallet } from '@/contracts'
import { AccountHeading } from '@/features/account/account-layout'
import { useUpdateWallet, useWallets } from '@/features/wallets/use-wallets'
import { FormAlert, PasswordField, TextField } from '@/shared/flow-ui/fields'
import { StatusPage } from '@/shared/layout/status-page'
import { isApiError } from '@/shared/api/api-error'
import { apiErrorMessage, applyApiErrors } from '@/shared/lib/form-errors'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import {
  accountFormSchema,
  AvatarFileError,
  useChangePassword,
  useProfile,
  useUpdateAvatar,
  useUpdateProfile,
  validateAvatarFile,
  type AccountFormValues,
} from '../use-profile'

/** Perfil do colecionador: data, ENS, wallet nickname, avatar (upload with preview) and password. */
export function ProfilePage() {
  const profile = useProfile()
  const wallets = useWallets()

  return (
    <section className="flex flex-col gap-8">
      {profile.isPending ? (
        <ProfileSkeleton />
      ) : profile.isError ? (
        <StatusPage
          icon={TriangleAlert}
          tone="error"
          title="Não foi possível carregar o perfil"
          actions={<Button onClick={() => void profile.refetch()}>Tentar novamente</Button>}
        >
          <p role="alert">{apiErrorMessage(profile.error)}</p>
        </StatusPage>
      ) : (
        <ProfileForm profile={profile.data} primaryWallet={wallets.data?.primary ?? null} walletsLoading={wallets.isPending} />
      )}
    </section>
  )
}

function ProfileSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando perfil" className="flex flex-col gap-6">
      <Skeleton className="h-4 w-56" />
      <div className="grid gap-6 md:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function valuesFrom(profile: Profile, wallet: Wallet | null): AccountFormValues {
  return {
    name: profile.name,
    username: profile.username,
    email: profile.email,
    ensName: profile.ensName,
    walletLabel: wallet?.label ?? '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  }
}

const PROFILE_KEYS = ['name', 'username', 'email', 'ensName'] as const

function ProfileForm({ profile, primaryWallet, walletsLoading }: { profile: Profile; primaryWallet: Wallet | null; walletsLoading: boolean }) {
  const updateProfile = useUpdateProfile()
  const updateWallet = useUpdateWallet()
  const changePassword = useChangePassword()
  const form = useForm<AccountFormValues>({ resolver: zodResolver(accountFormSchema), defaultValues: valuesFrom(profile, primaryWallet) })
  const { errors, isSubmitting, dirtyFields } = form.formState

  // Server data changed (save, refresh, another tab): refresh the pristine fields only.
  useEffect(() => {
    form.reset(valuesFrom(profile, primaryWallet), { keepDirtyValues: true })
  }, [profile, primaryWallet, form])

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (PROFILE_KEYS.some((key) => dirtyFields[key])) {
        await updateProfile.mutateAsync({ name: values.name, username: values.username, email: values.email, ensName: values.ensName, bio: profile.bio })
      }
    } catch (error) {
      applyApiErrors(error, form.setError, ['name', 'username', 'email', 'ensName'])
      return
    }
    try {
      if (dirtyFields.walletLabel && primaryWallet && values.walletLabel) {
        await updateWallet.mutateAsync({ id: primaryWallet.id, label: values.walletLabel })
      }
    } catch (error) {
      const message = (isApiError(error) && error.fieldErrors.label?.[0]) || apiErrorMessage(error)
      form.setError('walletLabel', { type: 'server', message }, { shouldFocus: true })
      return
    }
    try {
      if (values.currentPassword) {
        await changePassword.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword, confirmPassword: values.confirmPassword })
      }
    } catch (error) {
      applyApiErrors(error, form.setError, ['currentPassword', 'newPassword', 'confirmPassword'])
      return
    }
    form.reset({ ...values, currentPassword: '', newPassword: '', confirmPassword: '' })
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Perfil do colecionador" className="flex flex-col gap-8">
      <AccountHeading title="Perfil do colecionador" />
      <div className="grid gap-x-7 gap-y-6 md:grid-cols-2">
        <TextField label="Nome de exibição" required autoComplete="name" error={errors.name?.message} {...form.register('name')} />
        <TextField label="Nome de usuário" required autoComplete="username" error={errors.username?.message} {...form.register('username')} />
        <TextField label="E-mail" type="email" required autoComplete="email" error={errors.email?.message} {...form.register('email')} />
        <EnsInput error={errors.ensName?.message} register={form.register('ensName')} />
        <TextField
          label="Apelido da carteira"
          hint={walletsLoading ? 'Carregando carteiras…' : primaryWallet ? `Carteira principal (${primaryWallet.address.slice(0, 6)}…)` : 'Cadastre uma carteira em Carteiras para definir o apelido.'}
          disabled={!primaryWallet}
          error={errors.walletLabel?.message}
          {...form.register('walletLabel')}
        />
        <AvatarField profile={profile} />
      </div>

      <fieldset className="flex flex-col gap-6 md:max-w-[417px]">
        <legend className="mb-6 text-base leading-4 font-bold">Alterar senha</legend>
        <PasswordField label="Senha atual" autoComplete="current-password" error={errors.currentPassword?.message} {...form.register('currentPassword')} />
        <PasswordField
          label="Nova senha"
          autoComplete="new-password"
          hint="Mínimo de 8 caracteres, com letras e números."
          error={errors.newPassword?.message}
          {...form.register('newPassword')}
        />
        <PasswordField label="Confirmar nova senha" autoComplete="new-password" error={errors.confirmPassword?.message} {...form.register('confirmPassword')} />
      </fieldset>

      <FormAlert message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting || undefined} className="h-10 w-full font-bold md:w-[155px]">
        {isSubmitting ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

function EnsInput({ error, register }: { error?: string; register: ReturnType<ReturnType<typeof useForm<AccountFormValues>>['register']> }) {
  const id = useId()
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <label htmlFor={id} className="flex h-[29px] items-center text-[15px] leading-[15px]">
        Nome ENS (opcional)
      </label>
      <div className="flex gap-3">
        <span className="grid h-10 w-[92px] shrink-0 place-content-center rounded-sm border border-line text-base" aria-hidden="true">
          .eth
        </span>
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          className="h-10 min-w-0 flex-1 rounded-sm border border-line bg-surface-dark px-3 text-sm text-foreground outline-hidden placeholder:text-text-muted hover:border-line-soft focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-brand-accent aria-invalid:border-coral"
          {...register}
        />
      </div>
      <p id={`${id}-hint`} className="text-xs text-text-muted">
        Sem o sufixo .eth.
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-[13px] text-coral">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Avatar: "Alterar" picks an image (PNG/JPEG/WebP up to 1 MB, checked before reading), shows
 * a preview and only uploads after "Enviar"; "Remover" deletes it.
 */
function AvatarField({ profile }: { profile: Profile }) {
  const avatar = useUpdateAvatar()
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const id = useId()

  useEffect(() => () => {
    if (pending) URL.revokeObjectURL(pending.url)
  }, [pending])

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const invalid = validateAvatarFile(file)
    setError(invalid)
    if (invalid) return
    setPending({ file, url: URL.createObjectURL(file) })
  }

  const upload = () => {
    if (!pending) return
    avatar.mutate(pending.file, {
      onSuccess: () => setPending(null),
      onError: (e) => setError(e instanceof AvatarFileError ? e.message : apiErrorMessage(e)),
    })
  }

  const src = pending?.url ?? profile.avatarUrl
  return (
    <div className="flex flex-col gap-2.5" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="flex h-[29px] items-center text-[15px] leading-[15px]">
        Avatar
      </span>
      <div className="flex flex-wrap items-center gap-6">
        <span className="grid size-[60px] shrink-0 place-content-center overflow-hidden rounded-full border border-line bg-surface-raised text-brand-accent">
          {src ? (
            <img src={src} alt={pending ? 'Pré-visualização do novo avatar' : `Avatar de ${profile.name}`} className="size-[60px] object-cover" />
          ) : (
            <ImageUp className="size-6" aria-label="Sem avatar" />
          )}
        </span>
        <input
          ref={input}
          id={id}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          onChange={onFile}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          tabIndex={-1}
          aria-hidden="true"
        />
        {pending ? (
          <>
            <Button type="button" onClick={upload} disabled={avatar.isPending} className="h-10 px-6 font-bold">
              {avatar.isPending ? 'Enviando…' : 'Enviar avatar'}
            </Button>
            <Button type="button" variant="link" onClick={() => setPending(null)} disabled={avatar.isPending}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={() => input.current?.click()} className="h-10 px-6 font-bold" aria-describedby={`${id}-hint`}>
              Alterar<span className="sr-only"> avatar</span>
            </Button>
            {profile.avatarUrl ? (
              <Button type="button" variant="ghost" onClick={() => avatar.mutate(null)} disabled={avatar.isPending}>
                Remover<span className="sr-only"> avatar</span>
              </Button>
            ) : null}
          </>
        )}
      </div>
      <p id={`${id}-hint`} className="text-xs text-text-muted">
        PNG, JPEG ou WebP, até 1 MB.
      </p>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-coral">
          {error}
        </p>
      ) : null}
    </div>
  )
}
