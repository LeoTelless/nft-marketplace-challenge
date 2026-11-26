import { isAxiosError, isCancel } from 'axios'
import { apiErrorBodySchema, type ApiErrorCode, type FieldErrors } from '@/contracts'

/**
 * Kind of failure, independent of the HTTP status:
 * - `http`: the server answered with the standard error envelope;
 * - `network`: no response (offline, connection refused, CORS);
 * - `timeout`: the client gave up waiting (the server may still have processed it!);
 * - `canceled`: aborted through an `AbortSignal` (obsolete request), never shown to the user;
 * - `invalid_response`: 2xx body that does not match the contract.
 */
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'canceled' | 'invalid_response'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly code: ApiErrorCode | null
  readonly fieldErrors: FieldErrors
  readonly details: Record<string, unknown>
  /** Whether repeating the same request may succeed. */
  readonly retryable: boolean

  constructor(init: {
    kind: ApiErrorKind
    message: string
    status?: number | null
    code?: ApiErrorCode | null
    fieldErrors?: FieldErrors
    details?: Record<string, unknown>
    retryable?: boolean
    cause?: unknown
  }) {
    super(init.message, { cause: init.cause })
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status ?? null
    this.code = init.code ?? null
    this.fieldErrors = init.fieldErrors ?? {}
    this.details = init.details ?? {}
    this.retryable = init.retryable ?? false
  }

  get isUnauthorized() {
    return this.status === 401
  }
  get isForbidden() {
    return this.status === 403
  }
  get isNotFound() {
    return this.status === 404
  }
  get isConflict() {
    return this.status === 409
  }
  get isValidation() {
    return this.status === 422 || this.status === 400
  }
  /** 5xx, network failure or timeout. */
  get isTransient() {
    return this.kind === 'network' || this.kind === 'timeout' || (this.status !== null && this.status >= 500)
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** Converts anything thrown by Axios (or by response parsing) into an `ApiError`. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error

  if (isCancel(error)) {
    return new ApiError({ kind: 'canceled', message: 'Request canceled', cause: error })
  }

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'The server took too long to respond', retryable: true, cause: error })
    }
    if (!error.response) {
      return new ApiError({ kind: 'network', message: 'Could not reach the server', retryable: true, cause: error })
    }

    const { status, data } = error.response
    const parsed = apiErrorBodySchema.safeParse(data)
    if (parsed.success) {
      const body = parsed.data.error
      return new ApiError({
        kind: 'http',
        status,
        code: body.code,
        message: body.message,
        fieldErrors: body.fieldErrors,
        details: body.details,
        retryable: body.retryable,
        cause: error,
      })
    }
    return new ApiError({
      kind: 'http',
      status,
      code: status >= 500 ? 'server_error' : null,
      message: `Unexpected response (${status})`,
      retryable: status >= 500,
      cause: error,
    })
  }

  return new ApiError({
    kind: 'invalid_response',
    message: error instanceof Error ? error.message : 'Unexpected error',
    cause: error,
  })
}
