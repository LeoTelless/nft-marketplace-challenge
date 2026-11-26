import { expect, test } from '@playwright/test'
import {
  addEth,
  compareEth,
  formatEth,
  isEthAmount,
  maxEth,
  multiplyEth,
  normalizeEth,
  percentOfEth,
  subtractEth,
  sumLineTotals,
} from './eth.ts'

/**
 * Unit tests of the ETH arithmetic (`npm run test:unit`, Playwright runner without a browser).
 * Amounts are decimal strings with up to 18 decimals (wei); nothing goes through `number`.
 */

const WEI = '0.000000000000000001'

test.describe('arithmetic', () => {
  test('sums exactly, where binary floating point does not', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(addEth('0.1', '0.2')).toBe('0.3')
    expect(addEth('0.6703701', '0.0025', '0.0001')).toBe('0.6729701')
    expect(addEth()).toBe('0')
  })

  test('keeps all 18 decimals (1 wei) in sums and differences', () => {
    expect(addEth('1.000000000000000001', WEI)).toBe('1.000000000000000002')
    expect(addEth('999999999.999999999999999999', WEI)).toBe('1000000000')
    expect(subtractEth('0.3', '0.1')).toBe('0.2')
    expect(subtractEth('1', WEI)).toBe('0.999999999999999999')
  })

  test('multiplies by an integer quantity', () => {
    expect(multiplyEth('0.1', 3)).toBe('0.3')
    expect(multiplyEth('1.111111111111111111', 9)).toBe('9.999999999999999999')
    expect(multiplyEth(WEI, 1_000_000)).toBe('0.000000000001')
    expect(multiplyEth('12.5', 0)).toBe('0')
  })

  test('rejects quantities that are not non-negative integers', () => {
    expect(() => multiplyEth('1', 1.5)).toThrow(RangeError)
    expect(() => multiplyEth('1', -1)).toThrow(RangeError)
    expect(() => multiplyEth('1', Number.NaN)).toThrow(RangeError)
  })

  test('sums line totals (price x quantity) like the cart', () => {
    expect(
      sumLineTotals([
        { unitPrice: '0.1', quantity: 3 },
        { unitPrice: '0.2', quantity: 1 },
        { unitPrice: WEI, quantity: 2 },
      ]),
    ).toBe('0.500000000000000002')
    expect(sumLineTotals([])).toBe('0')
  })

  test('percentages truncate below 1 wei, never round up', () => {
    expect(percentOfEth('0.6703701', 10)).toBe('0.06703701')
    expect(percentOfEth('1', 25)).toBe('0.25')
    expect(percentOfEth('0.000000000000000009', 10)).toBe('0')
    expect(percentOfEth('0.000000000000000019', 10)).toBe(WEI)
  })

  test('compares by value, regardless of trailing zeros', () => {
    expect(compareEth('0.30', '0.3')).toBe(0)
    expect(compareEth('0.1', '0.2')).toBe(-1)
    expect(compareEth('1.000000000000000001', '1')).toBe(1)
    expect(maxEth('0.5', '0.50000000000000001')).toBe('0.50000000000000001')
  })
})

test.describe('normalization and validation', () => {
  test('normalizes to a plain decimal string with at most 18 decimals', () => {
    expect(normalizeEth('2.50')).toBe('2.5')
    expect(normalizeEth('1e-7')).toBe('0.0000001')
    expect(normalizeEth('1.1234567890123456789')).toBe('1.123456789012345678')
    expect(normalizeEth('123456789012345678901234567890')).toBe('123456789012345678901234567890')
  })

  test('accepts only decimal strings with up to 18 decimals', () => {
    expect(isEthAmount('0')).toBe(true)
    expect(isEthAmount('12.5')).toBe(true)
    expect(isEthAmount('1.123456789012345678')).toBe(true)
    expect(isEthAmount('1.1234567890123456789')).toBe(false)
    expect(isEthAmount('-1')).toBe(false)
    expect(isEthAmount('1e5')).toBe(false)
    expect(isEthAmount('.5')).toBe(false)
    expect(isEthAmount('1,5')).toBe(false)
  })
})

test.describe('display formatting (explicit options)', () => {
  test('truncates to the requested decimals and never rounds up', () => {
    expect(formatEth('0.99999', { maxDecimals: 4 })).toBe('0.9999 ETH')
    expect(formatEth('0.60583309', { maxDecimals: 6 })).toBe('0.605833 ETH')
    expect(formatEth('1.123456789012345678', { maxDecimals: 18 })).toBe('1.123456789012345678 ETH')
  })

  test('drops trailing zeros, pads to the minimum and can omit the symbol', () => {
    expect(formatEth('2.5000', { maxDecimals: 4 })).toBe('2.5 ETH')
    expect(formatEth('1', { maxDecimals: 4, minDecimals: 2 })).toBe('1.00 ETH')
    expect(formatEth('0', { maxDecimals: 4 })).toBe('0 ETH')
    expect(formatEth('3.3', { maxDecimals: 4, withSymbol: false })).toBe('3.3')
  })

  test('a non-zero value below the shown precision is not displayed as 0', () => {
    expect(formatEth('0.00001', { maxDecimals: 4 })).toBe('< 0.0001 ETH')
    expect(formatEth(WEI, { maxDecimals: 6 })).toBe('< 0.000001 ETH')
  })

  test('groups thousands without losing precision on very large amounts', () => {
    expect(formatEth('1234.56789', { maxDecimals: 4 })).toBe('1,234.5678 ETH')
    expect(formatEth('123456789012345678901234567890.5', { maxDecimals: 4 })).toBe('123,456,789,012,345,678,901,234,567,890.5 ETH')
    expect(formatEth('1234.5', { maxDecimals: 4, locale: 'pt-BR' })).toBe('1.234,5 ETH')
  })
})
