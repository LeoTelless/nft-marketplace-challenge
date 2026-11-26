import { zodResolver } from '@hookform/resolvers/zod'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import type { Profile } from '@/contracts'
import { FormError, TextField } from '@/features/auth/form-field'
import { useLogout } from '@/features/auth/use-auth'
import {
  AvatarFileError,
  PASSWORD_FIELDS,
  PROFILE_FIELDS,
  passwordFormSchema,
  profileFormSchema,
  useChangePassword,
  useProfile,
  useUpdateAvatar,
  useUpdateProfile,
  validateAvatarFile,
  type PasswordFormValues,
  type ProfileFormValues,
} from '@/features/profile/use-profile'
import { apiErrorMessage, applyApiErrors } from '@/shared/lib/form-errors'
import { Button } from '@/shared/ui/button'

/** Provisional profile screen (flow skeleton; the Figma layout comes in stage 2). */
export const Route = createFileRoute('/_authenticated/account/profile')({
  head: () => ({ meta: [{ title: 'Perfil | KURIO' }] }),
  component: ProfilePage,
})

function ProfilePage() {
  const profile = useProfile()
  const logout = useLogout()
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">Perfil do colecionador</h1>
        <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          Sair
        </Button>
      </div>
      {profile.isPending ? (
        <p aria-busy="true">Carregando perfil…</p>
      ) : profile.isError ? (
        <div role="alert">
          <p>{apiErrorMessage(profile.error)}</p>
          <Button variant="secondary" onClick={() => void profile.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <AvatarSection profile={profile.data} />
          <ProfileForm profile={profile.data} />
          <PasswordForm />
        </>
      )}
    </div>
  )
}

function AvatarSection({ profile }: { profile: Profile }) {
  const avatar = useUpdateAvatar()
  const [error, setError] = useState<string | null>(null)

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const invalid = validateAvatarFile(file)
    setError(invalid)
    if (invalid) return
    avatar.mutate(file, {
      onError: (e) => setError(e instanceof AvatarFileError ? e.message : apiErrorMessage(e)),
    })
  }

  return (
    <section aria-labelledby="avatar-title" className="flex items-center gap-4">
      <h2 id="avatar-title" className="sr-only">
        Avatar
      </h2>
      {profile.avatarUrl ? (
        <img src={profile.avatarUrl} alt={`Avatar de ${profile.name}`} className="size-16 rounded-full object-cover" />
      ) : (
        <div aria-label="Sem avatar" role="img" className="size-16 rounded-full border" />
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="avatar-file" className="text-sm">
          Alterar avatar (PNG, JPEG ou WebP, até 1 MB)
        </label>
        <input
          id="avatar-file"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onFile}
          disabled={avatar.isPending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'avatar-error' : undefined}
        />
        {error ? (
          <p id="avatar-error" role="alert" className="text-xs text-coral">
            {error}
          </p>
        ) : null}
        {profile.avatarUrl ? (
          <Button variant="link" onClick={() => avatar.mutate(null)} disabled={avatar.isPending}>
            Remover avatar
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function ProfileForm({ profile }: { profile: Profile }) {
  const update = useUpdateProfile()
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: profile.name, email: profile.email, bio: profile.bio },
  })
  useEffect(() => {
    form.reset({ name: profile.name, email: profile.email, bio: profile.bio })
  }, [profile, form])
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values)
    } catch (error) {
      applyApiErrors(error, form.setError, PROFILE_FIELDS)
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Dados do perfil" className="flex flex-col gap-3">
      <h2 className="font-semibold">Dados do perfil</h2>
      <TextField label="Nome de exibição" required error={errors.name?.message} {...form.register('name')} />
      <TextField label="E-mail" type="email" required error={errors.email?.message} {...form.register('email')} />
      <TextField label="Bio" error={errors.bio?.message} {...form.register('bio')} />
      <FormError message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting}>
        Salvar
      </Button>
    </form>
  )
}

function PasswordForm() {
  const change = useChangePassword()
  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await change.mutateAsync(values)
      form.reset()
    } catch (error) {
      applyApiErrors(error, form.setError, PASSWORD_FIELDS)
    }
  })

  return (
    <form noValidate onSubmit={onSubmit} aria-label="Alterar senha" className="flex flex-col gap-3">
      <h2 className="font-semibold">Alterar senha</h2>
      <TextField label="Senha atual" type="password" autoComplete="current-password" required error={errors.currentPassword?.message} {...form.register('currentPassword')} />
      <TextField label="Nova senha" type="password" autoComplete="new-password" required error={errors.newPassword?.message} {...form.register('newPassword')} />
      <TextField label="Confirmar nova senha" type="password" autoComplete="new-password" required error={errors.confirmPassword?.message} {...form.register('confirmPassword')} />
      <FormError message={errors.root?.server?.message} />
      <Button type="submit" disabled={isSubmitting}>
        Alterar senha
      </Button>
    </form>
  )
}
