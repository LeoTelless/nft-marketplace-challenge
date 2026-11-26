import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import {
  changePasswordRequestSchema,
  updateProfileRequestSchema,
  type Profile,
  type SessionInfo,
} from '@/contracts'
import { useSession } from '@/features/auth/session'
import { queryKeys } from '@/shared/api/query-keys'
import { notify } from '@/shared/feedback/notifications'
import { sessionStore } from '@/shared/session/session-store'
import { profileApi } from './api'

export const profileFormSchema = updateProfileRequestSchema
export type ProfileFormValues = z.infer<typeof profileFormSchema>
export const PROFILE_FIELDS = ['name', 'email', 'bio'] as const

export const passwordFormSchema = changePasswordRequestSchema
  .extend({ confirmPassword: z.string().min(1, 'Confirme a nova senha') })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ['confirmPassword'], message: 'As senhas não coincidem' })
  .refine((v) => v.newPassword !== v.currentPassword, { path: ['newPassword'], message: 'A nova senha deve ser diferente da atual' })
export type PasswordFormValues = z.infer<typeof passwordFormSchema>
export const PASSWORD_FIELDS = ['currentPassword', 'newPassword', 'confirmPassword'] as const

export const AVATAR_MAX_BYTES = 1_000_000
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Client-side avatar checks (type and size) before reading the file. `null` = valid. */
export function validateAvatarFile(file: File): string | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return 'Formato não suportado. Use PNG, JPEG ou WebP.'
  if (file.size > AVATAR_MAX_BYTES) return 'A imagem deve ter no máximo 1 MB.'
  return null
}

export class AvatarFileError extends Error {}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new AvatarFileError('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

function useUserId() {
  const { user } = useSession()
  return user?.id ?? null
}

/** Keeps the session user (header name/avatar) in sync with the saved profile. */
function syncSessionUser(queryClient: ReturnType<typeof useQueryClient>, profile: Profile) {
  queryClient.setQueryData<SessionInfo>(queryKeys.session(sessionStore.getToken()), (current) =>
    current ? { ...current, user: { ...current.user, name: profile.name, email: profile.email, avatarUrl: profile.avatarUrl } } : current,
  )
}

export function useProfile() {
  const userId = useUserId()
  return useQuery({
    queryKey: queryKeys.user.profile(userId ?? ''),
    queryFn: ({ signal }) => profileApi.get({ signal }),
    enabled: userId !== null,
  })
}

function useProfileWrite<TVars>(mutationFn: (vars: TVars) => Promise<Profile>, successTitle: string) {
  const queryClient = useQueryClient()
  const userId = useUserId()
  return useMutation({
    mutationFn,
    onSuccess: (profile) => {
      if (!userId) return
      queryClient.setQueryData(queryKeys.user.profile(userId), profile)
      syncSessionUser(queryClient, profile)
      notify({ tone: 'success', title: successTitle, key: 'profile' })
    },
  })
}

/** Errors (`ApiError` with `fieldErrors`, 409 `email_conflict`) are mapped by the form. */
export function useUpdateProfile() {
  return useProfileWrite((values: ProfileFormValues) => profileApi.update(values), 'Perfil atualizado.')
}

/** Upload (validated type/size, sent as data URL) or removal (`null`) of the avatar. */
export function useUpdateAvatar() {
  return useProfileWrite(async (file: File | null) => {
    if (file === null) return profileApi.updateAvatar({ dataUrl: null })
    const invalid = validateAvatarFile(file)
    if (invalid) throw new AvatarFileError(invalid)
    return profileApi.updateAvatar({ dataUrl: await readAsDataUrl(file) })
  }, 'Avatar atualizado.')
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ confirmPassword: _confirm, ...body }: PasswordFormValues) => profileApi.changePassword(body),
    onSuccess: () => notify({ tone: 'success', title: 'Senha alterada.', key: 'password' }),
  })
}
