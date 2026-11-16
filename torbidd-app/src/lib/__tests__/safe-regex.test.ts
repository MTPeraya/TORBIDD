// =============================================================================
// lib/__tests__/safe-regex.test.ts - Unit Tests for Regex Escaping & ReDoS Defense
// ASVS V1.2.9: Escape special characters in regular expressions
// ASVS V1.3.12: Prevent exponential backtracking & sanitize untrusted regex input
// =============================================================================

import {
  escapeRegex,
  sanitizeSearchRegex,
  createSafeRegex,
  MAX_REGEX_INPUT_LENGTH,
} from '../safe-regex';

describe('ASVS V1.2.9 & V1.3.12: Safe Regex & ReDoS Mitigation', () => {
  describe('escapeRegex', () => {
    it('escapes all standard ECMAScript regular expression metacharacters', () => {
      const allMetachars = '.*+?^${}()|[]\\/';
      const escaped = escapeRegex(allMetachars);
      expect(escaped).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\\\/');
    });

    it('treats user input with regex syntax as purely literal strings', () => {
      const userInput = 'test(123)[abc]+.*';
      const regex = new RegExp(escapeRegex(userInput));

      // Should match the exact literal string
      expect(regex.test('test(123)[abc]+.*')).toBe(true);
      // Should NOT match expanded/quantified forms
      expect(regex.test('test123abc')).toBe(false);
    });

    it('handles non-string inputs safely', () => {
      expect(escapeRegex(null)).toBe('');
      expect(escapeRegex(undefined)).toBe('');
      expect(escapeRegex(42 as unknown)).toBe('');
    });
  });

  describe('sanitizeSearchRegex', () => {
    it('trims whitespace and escapes metacharacters', () => {
      const raw = '   BMA [Special] (Project)   ';
      const result = sanitizeSearchRegex(raw);
      expect(result).toBe('BMA \\[Special\\] \\(Project\\)');
    });

    it('clamps excessive input lengths to prevent high-state memory exhaustion', () => {
      const longInput = 'a'.repeat(500);
      const result = sanitizeSearchRegex(longInput);
      expect(result.length).toBe(MAX_REGEX_INPUT_LENGTH);
    });
  });

  describe('createSafeRegex (ReDoS Defense)', () => {
    it('safely compiles potentially catastrophic backtracking patterns into safe literals', () => {
      // Classic ReDoS pattern: (a+)+$ or (a|aa)+
      const redosAttempt = '(a+)+$';
      const safeRegex = createSafeRegex(redosAttempt);

      // Must be safely escaped: \(a\+\)\+\$
      expect(safeRegex.source).toBe('\\(a\\+\\)\\+\\$');

      // Matching an evil string should NOT freeze or take exponential time
      const evilPayload = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaa!';
      const start = Date.now();
      expect(safeRegex.test(evilPayload)).toBe(false);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeLessThan(50); // Instant execution
    });

    it('supports case-insensitive searches by default', () => {
      const regex = createSafeRegex('software');
      expect(regex.test('Software Development')).toBe(true);
      expect(regex.test('SOFTWARE PORTAL')).toBe(true);
    });

    it('correctly handles Thai characters with tone marks and special characters', () => {
      const thaiSearch = 'ระบบจัดซื้อจัดจ้าง (e-GP)';
      const regex = createSafeRegex(thaiSearch);
      expect(regex.test('โครงการ ระบบจัดซื้อจัดจ้าง (e-GP) ประจำปี 2568')).toBe(true);
      expect(regex.test('ระบบจัดซื้อจัดจ้าง e-GP')).toBe(false); // Parentheses are literal
    });
  });
});
