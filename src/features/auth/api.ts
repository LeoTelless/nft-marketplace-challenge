import {
  endpoints,
  sessionInfoSchema,
  sessionSchema,
  type LoginRequest,
  type RegisterRequest,
} from '@/contracts'
import { request, requestVoid, type RequestOptions } from '@/shared/api/http'

export const authApi = {
  login: (body: LoginRequest) => request(sessionSchema, { method: 'POST', url: endpoints.login, data: body }),
  register: (body: RegisterRequest) => request(sessionSchema, { method: 'POST', url: endpoints.register, data: body }),
  logout: () => requestVoid({ method: 'POST', url: endpoints.logout }),
  getSession: (options?: RequestOptions) => request(sessionInfoSchema, { url: endpoints.session, ...options }),
}
