import { parseSearchWith, stringifySearchWith } from '@tanstack/react-router'

/**
 * Readable search params instead of the router's default JSON encoding
 * (`?category=art,music&minPrice=0.5` rather than `?category=%5B%22art%22%5D&minPrice=%220.5%22`).
 * - arrays are joined with commas (route schemas split them back);
 * - `true`/`false` round-trip as booleans; every other value stays a string
 *   (route schemas coerce numbers, e.g. `page`).
 */
function parseValue(value: string): unknown {
  if (value === 'true') return true
  if (value === 'false') return false
  // Throwing keeps the raw string.
  throw new Error('plain string')
}

function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(String).join(',')
  return JSON.stringify(value)
}

export const parseSearch = parseSearchWith(parseValue)
export const stringifySearch = stringifySearchWith(stringifyValue)
