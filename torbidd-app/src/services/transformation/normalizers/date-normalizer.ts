// =============================================================================
// services/transformation/normalizers/date-normalizer.ts
// Converts Thai Buddhist Era (พ.ศ.) & heterogeneous date formats to ISO-8601 UTC
// =============================================================================

const THAI_MONTH_MAP: Record<string, number> = {
  // Full names (0-indexed month)
  มกราคม: 0,
  กุมภาพันธ์: 1,
  มีนาคม: 2,
  เมษายน: 3,
  พฤษภาคม: 4,
  มิถุนายน: 5,
  กรกฎาคม: 6,
  สิงหาคม: 7,
  กันยายน: 8,
  ตุลาคม: 9,
  พฤศจิกายน: 10,
  ธันวาคม: 11,

  // Abbreviations with dots
  'ม.ค.': 0,
  'ก.พ.': 1,
  'มี.ค.': 2,
  'เม.ย.': 3,
  'พ.ค.': 4,
  'มิ.ย.': 5,
  'ก.ค.': 6,
  'ส.ค.': 7,
  'ก.ย.': 8,
  'ต.ค.': 9,
  'พ.ย.': 10,
  'ธ.ค.': 11,

  // Abbreviations without dots
  มค: 0,
  กพ: 1,
  มีค: 2,
  เมย: 3,
  พค: 4,
  มิย: 5,
  กค: 6,
  สค: 7,
  กย: 8,
  ตค: 9,
  พย: 10,
  ธค: 11,
};

/**
 * Convert Thai Buddhist Era (พ.ศ.) to Common Era (ค.ศ.)
 * If year is already CE (e.g. 2000-2100), it preserves it.
 * If 2-digit BE (e.g. 67, 68), converts to 2567 -> 2024.
 */
export function normalizeBuddhistYear(year: number): number {
  if (year >= 2400 && year <= 2700) {
    return year - 543;
  }
  if (year >= 40 && year <= 99) {
    // 2-digit Thai year (e.g., 67 -> 2567 -> 2024)
    return 2500 + year - 543;
  }
  return year;
}

/**
 * Parse heterogeneous date inputs (including Thai Buddhist Era) into an ISO-8601 UTC string.
 * Returns null if the date is invalid or unparseable.
 */
export function parseToIsoDate(rawDate: unknown): string | null {
  if (rawDate === null || rawDate === undefined || rawDate === '') {
    return null;
  }

  // If already a valid Date object
  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? null : rawDate.toISOString();
  }

  // If numeric timestamp (milliseconds or seconds)
  if (typeof rawDate === 'number') {
    const ts = rawDate < 10000000000 ? rawDate * 1000 : rawDate;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const str = String(rawDate).trim();
  if (!str) return null;

  // 1. Check Thai text date: e.g. "15 ส.ค. 2567", "1 ตุลาคม 2567", "28 ก.พ. 67"
  const thaiTextRegex = /^(\d{1,2})\s+([ก-๙\.]+)\s+(\d{2,4})$/;
  const thaiMatch = str.match(thaiTextRegex);
  if (thaiMatch) {
    const day = parseInt(thaiMatch[1], 10);
    const monthKey = thaiMatch[2].trim();
    const rawYear = parseInt(thaiMatch[3], 10);

    const monthIndex = THAI_MONTH_MAP[monthKey];
    if (monthIndex !== undefined) {
      const ceYear = normalizeBuddhistYear(rawYear);
      const dateObj = new Date(Date.UTC(ceYear, monthIndex, day));
      if (isValidDateComponents(dateObj, ceYear, monthIndex, day)) {
        return dateObj.toISOString();
      }
    }
  }

  // 2. Check compact numeric format: "YYYYMMDD" (e.g. "25670815" or "20240815")
  if (/^\d{8}$/.test(str)) {
    const rawYear = parseInt(str.slice(0, 4), 10);
    const month = parseInt(str.slice(4, 6), 10) - 1;
    const day = parseInt(str.slice(6, 8), 10);
    const ceYear = normalizeBuddhistYear(rawYear);
    const dateObj = new Date(Date.UTC(ceYear, month, day));
    if (isValidDateComponents(dateObj, ceYear, month, day)) {
      return dateObj.toISOString();
    }
  }

  // 3. Check slash or dash delimited: "DD/MM/YYYY" or "DD-MM-YYYY"
  const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/;
  const dmyMatch = str.match(dmyRegex);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const rawYear = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    const ceYear = normalizeBuddhistYear(rawYear);
    const dateObj = new Date(Date.UTC(ceYear, month, day, hour, minute, second));
    if (isValidDateComponents(dateObj, ceYear, month, day)) {
      return dateObj.toISOString();
    }
  }

  // 4. Check ISO-like formats: "YYYY-MM-DD" or "YYYY/MM/DD" (with possible Thai BE year)
  const ymdRegex = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
  const ymdMatch = str.match(ymdRegex);
  if (ymdMatch) {
    const rawYear = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;

    const ceYear = normalizeBuddhistYear(rawYear);
    const dateObj = new Date(Date.UTC(ceYear, month, day, hour, minute, second));
    if (isValidDateComponents(dateObj, ceYear, month, day)) {
      return dateObj.toISOString();
    }
  }

  // 5. Fallback standard JavaScript Date parse
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    // If year > 2400, adjust Buddhist Era year
    if (parsed.getUTCFullYear() >= 2400) {
      parsed.setUTCFullYear(parsed.getUTCFullYear() - 543);
    }
    return parsed.toISOString();
  }

  return null;
}

function isValidDateComponents(date: Date, year: number, month: number, day: number): boolean {
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
  );
}
