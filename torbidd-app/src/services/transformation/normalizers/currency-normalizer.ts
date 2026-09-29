// =============================================================================
// services/transformation/normalizers/currency-normalizer.ts
// Normalizes heterogeneous currency formats, symbols, and Thai text into clean numbers
// =============================================================================

export interface CurrencyNormalizationOptions {
  defaultValue?: number;
  allowNegative?: boolean;
}

/**
 * Normalizes heterogeneous agency currency inputs into a clean numeric value.
 * Handles:
 * - Currency symbols: ฿, $, THB, บาท
 * - Commas & whitespaces: "1,500,000.00", " 2 500 000 "
 * - Thai multipliers: "5.5 ล้าน", "10 ล้านบาท", "1.2 พันล้าน"
 * - Edge cases: "-", "N/A", null, undefined -> defaultValue (default 0)
 */
export function normalizeCurrency(
  rawAmount: unknown,
  options: CurrencyNormalizationOptions = {},
): number {
  const defaultValue = options.defaultValue ?? 0;
  const allowNegative = options.allowNegative ?? false;

  if (rawAmount === null || rawAmount === undefined || rawAmount === '') {
    return defaultValue;
  }

  if (typeof rawAmount === 'number') {
    if (isNaN(rawAmount) || !isFinite(rawAmount)) return defaultValue;
    if (!allowNegative && rawAmount < 0) return defaultValue;
    return rawAmount;
  }

  let str = String(rawAmount).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str === 'ไม่มี') {
    return defaultValue;
  }

  // Check for negative prefix
  const isNegative = str.startsWith('-') || str.includes('(ติดลบ)');

  // Handle Thai multipliers: "ล้าน", "พันล้าน", "แสน"
  const millionMatch = str.match(/([\d\.,]+)\s*ล้าน/);
  if (millionMatch) {
    const baseNum = parseFloat(millionMatch[1].replace(/,/g, ''));
    if (!isNaN(baseNum)) {
      const result = Math.round(baseNum * 1_000_000 * 100) / 100;
      return !allowNegative && isNegative ? defaultValue : isNegative ? -result : result;
    }
  }

  const billionMatch = str.match(/([\d\.,]+)\s*พันล้าน/);
  if (billionMatch) {
    const baseNum = parseFloat(billionMatch[1].replace(/,/g, ''));
    if (!isNaN(baseNum)) {
      const result = Math.round(baseNum * 1_000_000_000 * 100) / 100;
      return !allowNegative && isNegative ? defaultValue : isNegative ? -result : result;
    }
  }

  // Strip known currency words and symbols
  str = str
    .replace(/[฿$]/g, '')
    .replace(/\bTHB\b/gi, '')
    .replace(/บาท/g, '')
    .replace(/สตางค์/g, '')
    .replace(/\s+/g, '')
    .replace(/,/g, '');

  const parsed = parseFloat(str);
  if (isNaN(parsed) || !isFinite(parsed)) {
    return defaultValue;
  }

  if (!allowNegative && parsed < 0) {
    return defaultValue;
  }

  return Math.round(parsed * 100) / 100;
}
