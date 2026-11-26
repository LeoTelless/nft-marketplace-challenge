import {
  endpoints,
  profileSchema,
  type ChangePasswordRequest,
  type UpdateAvatarRequest,
  type UpdateProfileRequest,
} from '@/contracts'
import { request, requestVoid, type RequestOptions } from '@/shared/api/http'

export const profileApi = {
  get: (options?: RequestOptions) => request(profileSchema, { url: endpoints.profile, ...options }),
  update: (body: UpdateProfileRequest) => request(profileSchema, { method: 'PATCH', url: endpoints.profile, data: body }),
  updateAvatar: (body: UpdateAvatarRequest) =>
    request(profileSchema, { method: 'PUT', url: endpoints.avatar, data: body }),
  changePassword: (body: ChangePasswordRequest) =>
    requestVoid({ method: 'POST', url: endpoints.password, data: body }),
}
