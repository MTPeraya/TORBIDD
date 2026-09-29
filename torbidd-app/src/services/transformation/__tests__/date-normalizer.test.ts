/**
 * @jest-environment node
 */
// =============================================================================
// services/transformation/__tests__/date-normalizer.test.ts
// Unit tests for Thai Buddhist Era (พ.ศ.) & heterogeneous date normalization to ISO-8601
// =============================================================================

import {
  normalizeBuddhistYear,
  parseToIsoDate,
} from '../normalizers/date-normalizer';

describe('Date Normalizer (Thai Buddhist Era to ISO-8601)', () => {
  describe('normalizeBuddhistYear', () => {
    it('should convert 4-digit BE year to CE year', () => {
      expect(normalizeBuddhistYear(2567)).toBe(2024);
      expect(normalizeBuddhistYear(2568)).toBe(2025);
    });

    it('should convert 2-digit BE year to CE year', () => {
      expect(normalizeBuddhistYear(67)).toBe(2024);
      expect(normalizeBuddhistYear(68)).toBe(2025);
    });

    it('should preserve already CE years', () => {
      expect(normalizeBuddhistYear(2024)).toBe(2024);
      expect(normalizeBuddhistYear(2025)).toBe(2025);
    });
  });

  describe('parseToIsoDate', () => {
    it('1. should convert DD/MM/YYYY (พ.ศ.) to ISO-8601 UTC', () => {
      const iso = parseToIsoDate('15/08/2567');
      expect(iso).toBe('2024-08-15T00:00:00.000Z');
    });

    it('2. should convert YYYY-MM-DD (พ.ศ.) to ISO-8601 UTC', () => {
      const iso = parseToIsoDate('2567-08-15');
      expect(iso).toBe('2024-08-15T00:00:00.000Z');
    });

    it('3. should convert compact YYYYMMDD (พ.ศ.) to ISO-8601 UTC', () => {
      const iso = parseToIsoDate('25670815');
      expect(iso).toBe('2024-08-15T00:00:00.000Z');
    });

    it('4. should parse Thai text dates with full month names', () => {
      const iso = parseToIsoDate('1 ตุลาคม 2567');
      expect(iso).toBe('2024-10-01T00:00:00.000Z');
    });

    it('5. should parse Thai text dates with abbreviated month names and 2-digit year', () => {
      const iso = parseToIsoDate('15 ส.ค. 67');
      expect(iso).toBe('2024-08-15T00:00:00.000Z');
    });

    it('6. should correctly handle leap year in Buddhist Era (29 ก.พ. 2567 / 2024)', () => {
      const iso = parseToIsoDate('29/02/2567');
      expect(iso).toBe('2024-02-29T00:00:00.000Z');
    });

    it('7. should pass through standard CE ISO-8601 strings and Date objects', () => {
      const iso = parseToIsoDate('2024-08-15T10:30:00.000Z');
      expect(iso).toBe('2024-08-15T10:30:00.000Z');

      const dateObj = new Date('2025-01-01T00:00:00.000Z');
      expect(parseToIsoDate(dateObj)).toBe('2025-01-01T00:00:00.000Z');
    });

    it('8. should return null for invalid, non-existent, or malformed dates', () => {
      expect(parseToIsoDate('31/02/2567')).toBeNull(); // Feb 31 does not exist
      expect(parseToIsoDate('invalid-date')).toBeNull();
      expect(parseToIsoDate('')).toBeNull();
      expect(parseToIsoDate(null)).toBeNull();
      expect(parseToIsoDate(undefined)).toBeNull();
    });
  });
});
