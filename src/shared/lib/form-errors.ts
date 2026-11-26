import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import type { ApiErrorCode } from '@/contracts'
import { isApiError } from '@/shared/api/api-error'

/** User-facing (pt-BR) message for an API failure. The API's own message is the fallback. */
const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  unauthorized: 'Entre na sua conta para continuar.',
  session_expired: 'Sua sessão expirou. Entre novamente para continuar.',
  forbidden: 'Você não tem permissão para acessar este recurso.',
  not_found: 'Não encontramos o que você procurava.',
  availability_conflict: 'A quantidade pedida não está mais disponível.',
  email_conflict: 'Já existe uma conta com este e-mail.',
  idempotency_conflict: 'Esta tentativa de compra já foi usada com outros dados. Revise o pedido.',
  quote_outdated: 'Preços, disponibilidade ou taxas mudaram. Revise os novos valores.',
  wallet_conflict: 'Esta carteira conflita com uma já cadastrada.',
  wallet_not_connected: 'A carteira não está conectada nesta rede. Conecte-a novamente para confirmar a compra.',
  validation_error: 'Alguns campos estão inválidos.',
  coupon_invalid: 'Cupom inválido.',
  coupon_expired: 'Este cupom expirou.',
  wallet_rejected: 'A conexão foi recusada na carteira.',
  server_error: 'O servidor encontrou um erro. Tente novamente.',
  service_unavailable: 'Serviço temporariamente indisponível. Tente novamente.',
}

export function apiErrorMessage(error: unknown, fallback = 'Algo deu errado. Tente novamente.'): string {
  if (!isApiError(error)) return fallback
  if (error.kind === 'timeout') return 'O servidor demorou para responder.'
  if (error.kind === 'network') return 'Sem conexão com o servidor.'
  // Availability messages name the NFT/edition: the server text is more useful than a generic one.
  if (error.code === 'availability_conflict' && error.message) return error.message
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code]!
  return error.message || fallback
}

/**
 * Maps the API's `fieldErrors` (dot paths) onto react-hook-form fields. Errors on unknown
 * paths and the error itself (when no field matched) go to `root.server`.
 * Returns true when at least one field error was applied.
 */
export function applyApiErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: ReadonlyArray<Path<T>>,
): boolean {
  let applied = false
  if (isApiError(error)) {
    for (const [path, messages] of Object.entries(error.fieldErrors)) {
      if (!messages.length) continue
      if ((fields as readonly string[]).includes(path)) {
        setError(path as Path<T>, { type: 'server', message: messages[0] }, { shouldFocus: !applied })
        applied = true
      }
    }
  }
  if (!applied) setError('root.server' as Path<T>, { type: 'server', message: apiErrorMessage(error) })
  return applied
}
