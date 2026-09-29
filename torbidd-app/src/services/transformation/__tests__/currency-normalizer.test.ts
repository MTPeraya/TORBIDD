/**
 * @jest-environment node
 */
// =============================================================================
// services/transformation/__tests__/currency-normalizer.test.ts
// Unit tests for currency and numeric string normalization
// =============================================================================

import { normalizeCurrency } from '../normalizers/currency-normalizer';

describe('Currency Normalizer', () => {
  it('1. should parse standard numeric values directly', () => {
    expect(normalizeCurrency(5000000)).toBe(5000000);
    expect(normalizeCurrency(125000.75)).toBe(125000.75);
  });

  it('2. should strip currency symbols (฿, THB, บาท) and commas', () => {
    expect(normalizeCurrency('฿ 1,500,000.00 บาท')).toBe(1500000);
    expect(normalizeCurrency('THB 2,345,678.50')).toBe(2345678.5);
    expect(normalizeCurrency('1,200.00 บาท')).toBe(1200);
    expect(normalizeCurrency(' 5,000,000 ')).toBe(5000000);
  });

  it('3. should parse Thai multiplier expressions (ล้าน, พันล้าน)', () => {
    expect(normalizeCurrency('5.5 ล้าน')).toBe(5500000);
    expect(normalizeCurrency('10 ล้านบาท')).toBe(10000000);
    expect(normalizeCurrency('1.2 พันล้าน')).toBe(1200000000);
    expect(normalizeCurrency('0.8 ล้าน')).toBe(800000);
  });

  it('4. should handle empty, null, undefined, dash gracefully', () => {
    expect(normalizeCurrency('')).toBe(0);
    expect(normalizeCurrency('-')).toBe(0);
    expect(normalizeCurrency('N/A')).toBe(0);
    expect(normalizeCurrency('ไม่มี')).toBe(0);
    expect(normalizeCurrency(null)).toBe(0);
    expect(normalizeCurrency(undefined)).toBe(0);
    expect(normalizeCurrency(null, { defaultValue: 100 })).toBe(100);
  });

  it('5. should handle negative amounts according to options', () => {
    // Default disallows negative
    expect(normalizeCurrency('-5000')).toBe(0);
    // When allowed
    expect(normalizeCurrency('-5000', { allowNegative: true })).toBe(-5000);
  });
});
