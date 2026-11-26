import { z } from 'zod'

/**
 * Every non-2xx response of the API uses this envelope.
 *
 * | status | code                                                     | meaning                                   |
 * | ------ | -------------------------------------------------------- | ----------------------------------------- |
 * | 400    | `bad_request`, `idempotency_key_required`                | malformed request                         |
 * | 401    | `invalid_credentials`, `unauthorized`, `session_expired` | missing or invalid session                |
 * | 403    | `forbidden`                                              | authenticated but not allowed             |
 * | 404    | `not_found`                                              | resource does not exist                   |
 * | 409    | `availability_conflict`, `email_conflict`, `idempotency_conflict`, `quote_outdated`, `wallet_conflict`, `wallet_not_connected` | state conflict |
 * | 422    | `validation_error`, `coupon_invalid`, `coupon_expired`, `wallet_rejected` | semantic validation (field errors) |
 * | 5xx    | `server_error`, `service_unavailable`                    | transient failure                         |
 */
export const apiErrorCodeSchema = z.enum([
  'bad_request',
  'idempotency_key_required',
  'invalid_credentials',
  'unauthorized',
  'session_expired',
  'forbidden',
  'not_found',
  'availability_conflict',
  'email_conflict',
  'idempotency_conflict',
  'quote_outdated',
  'wallet_conflict',
  'wallet_not_connected',
  'validation_error',
  'coupon_invalid',
  'coupon_expired',
  'wallet_rejected',
  'server_error',
  'service_unavailable',
])
export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

/** Field path (dot notation, e.g. `collector.email`) to messages. */
export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()))
export type FieldErrors = z.infer<typeof fieldErrorsSchema>

/** `details.issues` of a 409 `availability_conflict`. */
export const availabilityIssueSchema = z.object({
  nftId: z.string(),
  editionId: z.string(),
  requested: z.number().int(),
  available: z.number().int(),
})
export type AvailabilityIssue = z.infer<typeof availabilityIssueSchema>

export const apiErrorBodySchema = z.object({
  error: z.object({
    status: z.number().int(),
    code: apiErrorCodeSchema,
    message: z.string(),
    /** Present on `validation_error` and other field-level errors. */
    fieldErrors: fieldErrorsSchema.optional(),
    /** Whether repeating the same request may succeed (5xx). */
    retryable: z.boolean(),
    /** Code-specific payload, e.g. availability issues or the fresh quote on `quote_outdated`. */
    details: z.record(z.string(), z.unknown()).optional(),
  }),
})
export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
