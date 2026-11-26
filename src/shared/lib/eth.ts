import BigFactory from 'big.js'
import type { EthAmount } from '@/contracts'

/**
 * ETH arithmetic without floating point. Values are decimal strings (see `ethAmountSchema`);
 * results are normalized to at most 18 decimals (wei), truncating toward zero.
 *
 * A dedicated Big constructor keeps this configuration isolated from any other user of big.js.
 */
const Big = BigFactory()
Big.DP = 18
Big.RM = Big.roundDown
/** Never print exponential notation (e.g. `1e-7`). */
Big.NE = -30
Big.PE = 40

export const ETH_DECIMALS = 18
type EthLike = EthAmount | string | number

function big(value: EthLike) {
  return new Big(value)
}

/** Canonical decimal string: no exponent, no trailing zeros, at most 18 decimals. */
export function normalizeEth(value: EthLike): EthAmount {
  return big(value).round(ETH_DECIMALS, Big.roundDown).toString()
}

export function isEthAmount(value: string): boolean {
  return /^\d+(\.\d{1,18})?$/.test(value)
}

export function addEth(...values: EthLike[]): EthAmount {
  return normalizeEth(values.reduce<InstanceType<typeof Big>>((acc, v) => acc.plus(v), big(0)).toString())
}

export function subtractEth(a: EthLike, b: EthLike): EthAmount {
  return normalizeEth(big(a).minus(b).toString())
}

/** `price × quantity`. Quantity must be a non-negative integer. */
export function multiplyEth(price: EthLike, quantity: number): EthAmount {
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, got ${quantity}`)
  }
  return normalizeEth(big(price).times(quantity).toString())
}

/** `amount × percent / 100`, truncated to wei. */
export function percentOfEth(amount: EthLike, percent: number): EthAmount {
  return normalizeEth(big(amount).times(percent).div(100).toString())
}

/** -1, 0 or 1. */
export function compareEth(a: EthLike, b: EthLike): -1 | 0 | 1 {
  return big(a).cmp(big(b)) as -1 | 0 | 1
}

export function maxEth(a: EthLike, b: EthLike): EthAmount {
  return compareEth(a, b) >= 0 ? normalizeEth(a) : normalizeEth(b)
}

export function sumLineTotals(lines: ReadonlyArray<{ unitPrice: EthLike; quantity: number }>): EthAmount {
  return addEth(...lines.map((line) => multiplyEth(line.unitPrice, line.quantity)))
}

export interface FormatEthOptions {
  /** Max decimals shown (truncated, never rounded up). Default 4. */
  maxDecimals?: number
  /** Min decimals shown. Default 0. */
  minDecimals?: number
  /** Append the currency symbol. Default true. */
  withSymbol?: boolean
  /** Locale used for the thousands separator. Default `en-US`. */
  locale?: string
}

/**
 * Display formatting. Works on the decimal string directly (no `Number` conversion),
 * so large or very precise amounts are never distorted. Values smaller than the
 * displayed precision are shown as `< 0.0001 ETH` instead of a misleading `0`.
 */
export function formatEth(value: EthLike, options: FormatEthOptions = {}): string {
  const { maxDecimals = 4, minDecimals = 0, withSymbol = true, locale = 'en-US' } = options
  const suffix = withSymbol ? ' ETH' : ''
  const amount = big(value)
  const truncated = amount.round(maxDecimals, Big.roundDown)

  if (truncated.eq(0) && !amount.eq(0)) {
    const smallest = `0.${'0'.repeat(Math.max(maxDecimals - 1, 0))}1`
    return `< ${smallest}${suffix}`
  }

  const [integerPart, fractionPart = ''] = truncated.toFixed(maxDecimals, Big.roundDown).split('.')
  let fraction = fractionPart.replace(/0+$/, '')
  if (fraction.length < minDecimals) fraction = fraction.padEnd(minDecimals, '0')

  const groupSeparator = new Intl.NumberFormat(locale).formatToParts(1000).find((p) => p.type === 'group')?.value ?? ','
  const decimalSeparator = new Intl.NumberFormat(locale).formatToParts(1.1).find((p) => p.type === 'decimal')?.value ?? '.'
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator)

  return `${groupedInteger}${fraction ? decimalSeparator + fraction : ''}${suffix}`
}
