// =============================================================================
// services/translation/__tests__/translation-cache.test.ts
// Unit tests for TranslationCache storage, retrieval, hashing, isolation, & invalidation
// =============================================================================

import {
  TranslationCache,
  defaultTranslationCache,
} from '../translation-cache';

describe('TranslationCache', () => {
  let cache: TranslationCache;

  beforeEach(() => {
    cache = new TranslationCache();
    defaultTranslationCache.clear();
  });

  describe('Storage and Retrieval', () => {
    it('stores and retrieves a translated field for a given content hash', () => {
      const hash = 'a6c8e9b4f123456789abcdef0123456789abcdef0123456789abcdef01234567';
      const field = 'title';
      const translation = 'BMA Digital Infrastructure Upgrade';

      cache.set(hash, field, translation);

      expect(cache.get(hash, field)).toBe(translation);
      expect(cache.has(hash, field)).toBe(true);
      expect(cache.size()).toBe(1);
    });

    it('returns null on cache miss for non-existent content hash or field', () => {
      const hash = 'nonexistent-hash';
      expect(cache.get(hash, 'title')).toBeNull();
      expect(cache.has(hash, 'title')).toBe(false);
    });

    it('returns null when querying an un-cached field on an existing content hash', () => {
      const hash = 'hash-with-title-only';
      cache.set(hash, 'title', 'Translated Title');

      expect(cache.get(hash, 'title')).toBe('Translated Title');
      expect(cache.get(hash, 'department')).toBeNull();
      expect(cache.has(hash, 'department')).toBe(false);
    });

    it('safely handles empty, null, or undefined parameters without crashing', () => {
      expect(cache.get('', 'title')).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(cache.get(null as any, 'title')).toBeNull();

      // Setting with invalid parameters is a no-op
      cache.set('', 'title', 'val');
      cache.set('hash', '', 'val');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      cache.set('hash', 'title', null as any);

      expect(cache.size()).toBe(0);
    });
  });

  describe('Multiple Fields Storage & Retrieval (getMany / setMany)', () => {
    it('stores and retrieves multiple translated fields simultaneously for a single hash', () => {
      const hash = 'hash-multiple-fields';
      const entries = {
        title: 'BMA Smart School Platform',
        department: 'Department of Education',
        description: 'Comprehensive e-learning management system for schools',
        summary: 'Cloud-based education software',
      };

      cache.setMany(hash, entries);

      expect(cache.size()).toBe(4);

      const retrieved = cache.getMany(hash, ['title', 'department', 'description', 'summary', 'missingField']);

      expect(retrieved.title).toBe(entries.title);
      expect(retrieved.department).toBe(entries.department);
      expect(retrieved.description).toBe(entries.description);
      expect(retrieved.summary).toBe(entries.summary);
      expect(retrieved.missingField).toBeNull();
    });
  });

  describe('Cache Isolation across Different Content Hashes', () => {
    it('guarantees different content hashes do not share or overwrite each other', () => {
      const hashA = 'hash-project-alpha-111111111111111111111111111111111111111111111111';
      const hashB = 'hash-project-beta-222222222222222222222222222222222222222222222222';

      cache.set(hashA, 'title', 'Alpha Project Translation');
      cache.set(hashB, 'title', 'Beta Project Translation');

      expect(cache.get(hashA, 'title')).toBe('Alpha Project Translation');
      expect(cache.get(hashB, 'title')).toBe('Beta Project Translation');

      // Modifying hashA does not affect hashB
      cache.set(hashA, 'title', 'Alpha Updated Translation');
      expect(cache.get(hashA, 'title')).toBe('Alpha Updated Translation');
      expect(cache.get(hashB, 'title')).toBe('Beta Project Translation');
    });

    it('ensures content changes produce different hashes and trigger cache misses (no stale data)', () => {
      const originalContent = 'โครงการจัดซื้อครุภัณฑ์คอมพิวเตอร์ 50 เครื่อง';
      const modifiedContent = 'โครงการจัดซื้อครุภัณฑ์คอมพิวเตอร์ 100 เครื่อง';

      const originalHash = TranslationCache.computeContentHash(originalContent);
      const modifiedHash = TranslationCache.computeContentHash(modifiedContent);

      expect(originalHash).not.toBe(modifiedHash);

      // Cache translation under originalHash
      cache.set(originalHash, 'title', 'Procurement of 50 Computer Units');

      // Querying with originalHash hits the cache
      expect(cache.get(originalHash, 'title')).toBe('Procurement of 50 Computer Units');

      // Querying with modifiedHash misses the cache, ensuring stale translation is not returned
      expect(cache.get(modifiedHash, 'title')).toBeNull();
    });
  });

  describe('Cache Invalidation', () => {
    it('invalidates all fields for a specific content hash without affecting other hashes', () => {
      const hash1 = 'hash-to-invalidate-1';
      const hash2 = 'hash-to-keep-2';

      cache.set(hash1, 'title', 'Title 1');
      cache.set(hash1, 'department', 'Dept 1');
      cache.set(hash2, 'title', 'Title 2');

      expect(cache.size()).toBe(3);

      cache.invalidate(hash1);

      expect(cache.get(hash1, 'title')).toBeNull();
      expect(cache.get(hash1, 'department')).toBeNull();
      expect(cache.has(hash1, 'title')).toBe(false);

      // hash2 remains intact
      expect(cache.get(hash2, 'title')).toBe('Title 2');
      expect(cache.size()).toBe(1);
    });

    it('invalidates an individual field for a content hash using invalidateField', () => {
      const hash = 'hash-single-field-invalidation';

      cache.set(hash, 'title', 'BMA AI Center');
      cache.set(hash, 'department', 'Strategy and Evaluation Department');

      cache.invalidateField(hash, 'title');

      expect(cache.get(hash, 'title')).toBeNull();
      expect(cache.get(hash, 'department')).toBe('Strategy and Evaluation Department');
      expect(cache.size()).toBe(1);
    });

    it('clears all cached entries across all hashes using clear()', () => {
      cache.set('hash-1', 'title', 'Title 1');
      cache.set('hash-2', 'title', 'Title 2');
      cache.set('hash-3', 'title', 'Title 3');

      expect(cache.size()).toBe(3);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('hash-1', 'title')).toBeNull();
      expect(cache.get('hash-2', 'title')).toBeNull();
      expect(cache.get('hash-3', 'title')).toBeNull();
    });
  });

  describe('TTL and Expiration', () => {
    it('returns null and removes entry when TTL expires', () => {
      const hash = 'hash-expiring';
      const ttlMs = 50; // 50 ms

      cache.set(hash, 'title', 'Expiring Translation', ttlMs);
      expect(cache.get(hash, 'title')).toBe('Expiring Translation');

      // Fast-forward time past expiration
      const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 100);

      expect(cache.get(hash, 'title')).toBeNull();
      expect(cache.has(hash, 'title')).toBe(false);

      nowSpy.mockRestore();
    });
  });

  describe('Deterministic Content Hash Computation', () => {
    it('computes identical SHA-256 hashes for identical text inputs', () => {
      const text1 = 'โครงการก่อสร้างปรับปรุงสะพานข้ามแม่น้ำเจ้าพระยา';
      const text2 = 'โครงการก่อสร้างปรับปรุงสะพานข้ามแม่น้ำเจ้าพระยา';

      const hash1 = TranslationCache.computeContentHash(text1);
      const hash2 = TranslationCache.computeContentHash(text2);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });

    it('computes different SHA-256 hashes for different text inputs', () => {
      const textA = 'โครงการ A';
      const textB = 'โครงการ B';

      const hashA = TranslationCache.computeContentHash(textA);
      const hashB = TranslationCache.computeContentHash(textB);

      expect(hashA).not.toBe(hashB);
    });

    it('computes deterministic hashes for object inputs', () => {
      const obj1 = { title: 'ระบบบำบัดน้ำเสีย', budget: 5000000 };
      const obj2 = { title: 'ระบบบำบัดน้ำเสีย', budget: 5000000 };

      const hash1 = TranslationCache.computeContentHash(obj1);
      const hash2 = TranslationCache.computeContentHash(obj2);

      expect(hash1).toHaveLength(64);
      expect(hash1).toBe(hash2);
    });
  });
});
