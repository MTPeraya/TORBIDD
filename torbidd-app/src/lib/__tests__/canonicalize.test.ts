// =============================================================================
// lib/__tests__/canonicalize.test.ts - Unit Tests for Input Canonicalization
// ASVS Requirement V1.1.1: Input Canonicalization Architecture
// =============================================================================

import {
  canonicalizeString,
  canonicalizeData,
  canonicalString,
} from '../canonicalize';
import {
  ProjectFiltersSchema,
  BookmarkCreateSchema,
  SettingsUpdateSchema,
  AiClassifySchema,
} from '../validation';
import { z } from 'zod';

describe('ASVS V1.1.1: Input Canonicalization Architecture', () => {
  describe('canonicalizeString', () => {
    it('normalizes Thai combining characters into canonical Unicode NFC form', () => {
      // Decomposed Thai character: ก + ◌่ (Mai Ek) vs precomposed NFC
      const rawNFD = 'ก\u0E48';
      const canonicalNFC = rawNFD.normalize('NFC');
      const result = canonicalizeString(rawNFD);

      expect(result).toBe(canonicalNFC);
      // Double normalization remains canonical and idempotent
      expect(canonicalizeString(result)).toBe(canonicalNFC);
    });

    it('strips null bytes (\u0000) to prevent path traversal and injection bypasses', () => {
      const maliciousInput = 'admin\u0000.pdf';
      expect(canonicalizeString(maliciousInput)).toBe('admin.pdf');
    });

    it('strips invisible zero-width spaces and joiners used for filter evasion', () => {
      // Zero-width space \u200B placed inside a restricted keyword
      const evasiveInput = 'ซอฟต์\u200Bแวร์';
      expect(canonicalizeString(evasiveInput)).toBe('ซอฟต์แวร์');
    });

    it('strips bidirectional override characters', () => {
      // Left-to-Right override (\u202D) and Right-to-Left override (\u202E)
      const bidiInput = 'user\u202Ereversed\u202Cname';
      expect(canonicalizeString(bidiInput)).toBe('userreversedname');
    });

    it('trims leading and trailing whitespace by default', () => {
      expect(canonicalizeString('   สำนักยุทธศาสตร์และประเมินผล   ')).toBe(
        'สำนักยุทธศาสตร์และประเมินผล',
      );
    });

    it('handles non-string inputs safely by returning empty string', () => {
      expect(canonicalizeString(null)).toBe('');
      expect(canonicalizeString(undefined)).toBe('');
      expect(canonicalizeString(12345 as unknown)).toBe('');
    });
  });

  describe('canonicalizeData (Recursive traversal)', () => {
    it('recursively canonicalizes nested objects and arrays', () => {
      const input = {
        title: '  ระบบสารสนเทศ\u0000  ',
        tags: ['  AI\u200B  ', 'Cloud  '],
        nested: {
          agency: '  BMA\u0000  ',
        },
      };

      const canonical = canonicalizeData(input);
      expect(canonical).toEqual({
        title: 'ระบบสารสนเทศ',
        tags: ['AI', 'Cloud'],
        nested: {
          agency: 'BMA',
        },
      });
    });
  });

  describe('Zod Schema Integration (ASVS V1.1.1 before validation)', () => {
    it('canonicalizes search parameters in ProjectFiltersSchema before length/pattern check', () => {
      const parsed = ProjectFiltersSchema.parse({
        search: '  ระบบจัดซื้อ\u0000ซอฟต์แวร์   ',
      });
      expect(parsed.search).toBe('ระบบจัดซื้อซอฟต์แวร์');
    });

    it('canonicalizes projectId in BookmarkCreateSchema', () => {
      const rawId = '  671195389911234567890123  ';
      const parsed = BookmarkCreateSchema.parse({
        projectId: rawId,
      });
      expect(parsed.projectId).toBe('671195389911234567890123');
    });

    it('canonicalizes arrays of keywords in SettingsUpdateSchema', () => {
      const parsed = SettingsUpdateSchema.parse({
        keywords: ['  ERP\u200B  ', '  Security\u0000  '],
      });
      expect(parsed.keywords).toEqual(['ERP', 'Security']);
    });

    it('canonicalizes AI classification title and description in AiClassifySchema', () => {
      const parsed = AiClassifySchema.parse({
        title: '   โครงการติดตั้งระบบเครือข่าย\u0000   ',
        description: '   รายละเอียดขอบเขตงาน\u200B   ',
      });
      expect(parsed.title).toBe('โครงการติดตั้งระบบเครือข่าย');
      expect(parsed.description).toBe('รายละเอียดขอบเขตงาน');
    });

    it('performs canonicalization only once and is idempotent', () => {
      const schema = canonicalString(z.string().min(3));
      const firstPass = schema.parse('   Test\u0000   ');
      const secondPass = schema.parse(firstPass);
      expect(firstPass).toBe('Test');
      expect(secondPass).toBe('Test');
    });
  });
});
