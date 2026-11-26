import { z } from 'zod'

/**
 * Default validation messages in pt-BR (the UI language). Applies to the forms (zodResolver)
 * and to the mock API's `fieldErrors`, which reuse the same schemas.
 */
z.config(z.locales.pt())
