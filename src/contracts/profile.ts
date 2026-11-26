import { z } from 'zod'
import { passwordSchema } from './auth'
import { idSchema } from './common'

/** `GET /profile` (auth). */
export const profileSchema = z.object({
  id: idSchema,
  name: z.string(),
  email: z.email(),
  bio: z.string(),
  avatarUrl: z.string().nullable(),
})
export type Profile = z.infer<typeof profileSchema>

/** `PATCH /profile` returns Profile. 409 `email_conflict`, 422 `validation_error`. */
export const updateProfileRequestSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.email(),
  bio: z.string().max(280),
})
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>

/** `PUT /profile/avatar` returns Profile. Image as data URL (png/jpeg/webp, about 1 MB max); `null` removes it. */
export const updateAvatarRequestSchema = z.object({
  dataUrl: z
    .string()
    .regex(/^data:image\/(png|jpeg|webp);base64,/, 'Formato de imagem não suportado (use PNG, JPEG ou WebP)')
    .max(1_400_000, 'Imagem grande demais (máximo 1 MB)')
    .nullable(),
})
export type UpdateAvatarRequest = z.infer<typeof updateAvatarRequestSchema>

/** `POST /profile/password` returns 204. 422 with `fieldErrors.currentPassword` when it does not match. */
export const changePasswordRequestSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
})
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>
