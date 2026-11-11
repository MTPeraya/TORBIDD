// =============================================================================
// services/translation/__tests__/auto-translation.test.ts
// Comprehensive unit tests for AutoTranslationService:
// Translation, batching, field mapping, caching, error handling & quality validation
// =============================================================================

import {
  AutoTranslationService,
  TranslationError,
  TranslatableProject,
} from '../auto-translation';
import { TranslationCache } from '../translation-cache';

// Mock @google-cloud/translate
const mockTranslateText = jest.fn();

jest.mock('@google-cloud/translate', () => {
  return {
    TranslationServiceClient: jest.fn().mockImplementation(() => {
      return {
        translateText: mockTranslateText,
      };
    }),
  };
}, { virtual: true });

describe('AutoTranslationService', () => {
  let service: AutoTranslationService;
  let testCache: TranslationCache;

  // Standard Deterministic Fixtures
  const FIXTURES = {
    titleTh: 'โครงการพัฒนาระบบคลาวด์และดาต้าเซ็นเตอร์',
    titleEn: 'Cloud and Data Center System Development Project',
    deptTh: 'สำนักการจราจรและขนส่ง',
    deptEn: 'Traffic and Transportation Department',
    descTh: 'พัฒนาระบบสารสนเทศสำหรับการบริหารจัดการการจราจรแบบบูรณาการ',
    descEn: 'Development of an integrated information system for traffic management',
    summaryTh: 'ระบบคลาวด์สำหรับบริหารจัดการข้อมูลจราจร',
    summaryEn: 'Cloud system for traffic data management',
    hash: 'deterministic-content-hash-0123456789abcdef0123456789abcdef01234567',
  };

  function mockSuccessfulApiResponse(translations: string[]) {
    mockTranslateText.mockResolvedValue([
      {
        translations: translations.map((t) => ({ translatedText: t })),
      },
    ]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockTranslateText.mockReset();
    testCache = new TranslationCache();
    service = new AutoTranslationService({
      cache: testCache,
      projectId: 'test-gcp-project',
      location: 'global',
      validateQuality: true,
    });
  });

  describe('Single Text Translation (translateText)', () => {
    it('translates Thai content into English correctly and caches the result', async () => {
      mockSuccessfulApiResponse([FIXTURES.titleEn]);

      const result = await service.translateText(FIXTURES.titleTh, {
        contentHash: FIXTURES.hash,
        field: 'title',
      });

      expect(result.translatedText).toBe(FIXTURES.titleEn);
      expect(result.cached).toBe(false);
      expect(result.validation?.isValid).toBe(true);
      expect(result.validation?.code).toBe('OK');

      // Verify API client was called with correct parameters
      expect(mockTranslateText).toHaveBeenCalledTimes(1);
      expect(mockTranslateText).toHaveBeenCalledWith({
        parent: 'projects/test-gcp-project/locations/global',
        contents: [FIXTURES.titleTh],
        mimeType: 'text/plain',
        sourceLanguageCode: 'th',
        targetLanguageCode: 'en',
      });

      // Verify translation was stored in cache
      expect(testCache.get(FIXTURES.hash, 'title')).toBe(FIXTURES.titleEn);
    });

    it('returns cached translation without calling the Translation API on cache hit', async () => {
      // Pre-seed cache
      testCache.set(FIXTURES.hash, 'title', FIXTURES.titleEn);

      const result = await service.translateText(FIXTURES.titleTh, {
        contentHash: FIXTURES.hash,
        field: 'title',
      });

      expect(result.translatedText).toBe(FIXTURES.titleEn);
      expect(result.cached).toBe(true);

      // Verify zero Google Cloud API calls were made
      expect(mockTranslateText).not.toHaveBeenCalled();
    });

    it('bypasses cache when bypassCache option is true', async () => {
      testCache.set(FIXTURES.hash, 'title', 'Old Cached Translation');
      mockSuccessfulApiResponse([FIXTURES.titleEn]);

      const result = await service.translateText(FIXTURES.titleTh, {
        contentHash: FIXTURES.hash,
        field: 'title',
        bypassCache: true,
      });

      expect(result.translatedText).toBe(FIXTURES.titleEn);
      expect(result.cached).toBe(false);
      expect(mockTranslateText).toHaveBeenCalledTimes(1);
    });

    it('throws TranslationError when text to translate is missing or empty', async () => {
      await expect(service.translateText('')).rejects.toThrow(TranslationError);
      await expect(service.translateText('   ')).rejects.toThrow(TranslationError);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(service.translateText(null as any)).rejects.toThrow(TranslationError);
      expect(mockTranslateText).not.toHaveBeenCalled();
    });
  });

  describe('Project Translatable Fields and Update Structure Mapping', () => {
    it('translates project title and department name and maps to update fields while preserving original Thai text', async () => {
      mockSuccessfulApiResponse([FIXTURES.titleEn, FIXTURES.deptEn]);

      const project: TranslatableProject = {
        id: 'proj-001',
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh, en: '' },
        department: { th: FIXTURES.deptTh, en: '' },
      };

      const result = await service.translateProject(project);

      // Verify translations object
      expect(result.translations.title).toBe(FIXTURES.titleEn);
      expect(result.translations.department).toBe(FIXTURES.deptEn);

      // Verify update structure: original Thai content remains unchanged!
      expect(result.updatedFields.title).toEqual({
        th: FIXTURES.titleTh,
        en: FIXTURES.titleEn,
      });
      expect(result.updatedFields.department).toEqual({
        th: FIXTURES.deptTh,
        en: FIXTURES.deptEn,
      });

      // Verify statistics
      expect(result.stats.totalFields).toBe(2);
      expect(result.stats.translatedCount).toBe(2);
      expect(result.stats.cachedCount).toBe(0);
      expect(result.stats.apiCalls).toBe(1);
    });

    it('translates flat projectName and agencyName fields and maps to both bilingual and flat update fields', async () => {
      mockSuccessfulApiResponse([FIXTURES.titleEn, FIXTURES.deptEn]);

      const project: TranslatableProject = {
        externalProjectId: '67119538991',
        contentHash: FIXTURES.hash,
        projectName: FIXTURES.titleTh,
        agencyName: FIXTURES.deptTh,
      };

      const result = await service.translateProject(project);

      // Thai content preserved in bilingual structure
      expect(result.updatedFields.title).toEqual({
        th: FIXTURES.titleTh,
        en: FIXTURES.titleEn,
      });
      expect(result.updatedFields.department).toEqual({
        th: FIXTURES.deptTh,
        en: FIXTURES.deptEn,
      });

      // Flat English aliases mapped correctly
      expect(result.updatedFields.projectNameEn).toBe(FIXTURES.titleEn);
      expect(result.updatedFields.agencyNameEn).toBe(FIXTURES.deptEn);
    });

    it('translates optional description and summary fields when present', async () => {
      mockSuccessfulApiResponse([
        FIXTURES.titleEn,
        FIXTURES.deptEn,
        FIXTURES.descEn,
        FIXTURES.summaryEn,
      ]);

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh },
        department: { th: FIXTURES.deptTh },
        description: { th: FIXTURES.descTh },
        summary: { th: FIXTURES.summaryTh },
      };

      const result = await service.translateProject(project);

      expect(result.updatedFields.description).toEqual({
        th: FIXTURES.descTh,
        en: FIXTURES.descEn,
      });
      expect(result.updatedFields.summary).toEqual({
        th: FIXTURES.summaryTh,
        en: FIXTURES.summaryEn,
      });
      expect(result.stats.translatedCount).toBe(4);
    });
  });

  describe('Batching Efficiency', () => {
    it('batches multiple translatable fields into a single Translation API request', async () => {
      mockSuccessfulApiResponse([FIXTURES.titleEn, FIXTURES.deptEn, FIXTURES.descEn]);

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh },
        department: { th: FIXTURES.deptTh },
        description: { th: FIXTURES.descTh },
      };

      await service.translateProject(project);

      // Crucial: exactly 1 API call for all 3 fields, not 3 separate calls
      expect(mockTranslateText).toHaveBeenCalledTimes(1);

      const callArgs = mockTranslateText.mock.calls[0][0];
      expect(callArgs.contents).toEqual([
        FIXTURES.titleTh,
        FIXTURES.deptTh,
        FIXTURES.descTh,
      ]);
      expect(callArgs.contents.length).toBe(3);
    });

    it('batches multiple texts efficiently in translateBatch', async () => {
      const texts = ['ข้อความที่หนึ่ง', 'ข้อความที่สอง', 'ข้อความที่สาม'];
      const expected = ['First text', 'Second text', 'Third text'];
      mockSuccessfulApiResponse(expected);

      const results = await service.translateBatch(texts);

      expect(results).toEqual(expected);
      expect(mockTranslateText).toHaveBeenCalledTimes(1);
      expect(mockTranslateText.mock.calls[0][0].contents).toEqual(texts);
    });

    it('returns empty array when translateBatch is called with empty array without invoking API', async () => {
      const results = await service.translateBatch([]);
      expect(results).toEqual([]);
      expect(mockTranslateText).not.toHaveBeenCalled();
    });
  });

  describe('Cache Hit, Cache Miss, and Partial Cache Hit Handling', () => {
    it('completely bypasses API calls when all project fields are in cache', async () => {
      // Pre-seed cache with both title and department
      testCache.set(FIXTURES.hash, 'title', FIXTURES.titleEn);
      testCache.set(FIXTURES.hash, 'department', FIXTURES.deptEn);

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh },
        department: { th: FIXTURES.deptTh },
      };

      const result = await service.translateProject(project);

      // Verify zero API calls
      expect(mockTranslateText).not.toHaveBeenCalled();
      expect(result.stats.apiCalls).toBe(0);
      expect(result.stats.cachedCount).toBe(2);
      expect(result.stats.translatedCount).toBe(0);

      // Update structure must still be fully preserved
      expect(result.updatedFields.title).toEqual({
        th: FIXTURES.titleTh,
        en: FIXTURES.titleEn,
      });
      expect(result.updatedFields.department).toEqual({
        th: FIXTURES.deptTh,
        en: FIXTURES.deptEn,
      });
    });

    it('handles partial cache hit by batching ONLY uncached fields', async () => {
      // Title is already cached; Department is NOT cached
      testCache.set(FIXTURES.hash, 'title', FIXTURES.titleEn);
      mockSuccessfulApiResponse([FIXTURES.deptEn]);

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh },
        department: { th: FIXTURES.deptTh },
      };

      const result = await service.translateProject(project);

      // Exactly 1 API call made
      expect(mockTranslateText).toHaveBeenCalledTimes(1);

      // Contents array contains ONLY the department (1 field), NOT title
      expect(mockTranslateText.mock.calls[0][0].contents).toEqual([FIXTURES.deptTh]);

      // Both fields properly represented in result
      expect(result.updatedFields.title).toEqual({
        th: FIXTURES.titleTh,
        en: FIXTURES.titleEn,
      });
      expect(result.updatedFields.department).toEqual({
        th: FIXTURES.deptTh,
        en: FIXTURES.deptEn,
      });

      expect(result.stats.cachedCount).toBe(1);
      expect(result.stats.translatedCount).toBe(1);
      expect(result.stats.apiCalls).toBe(1);

      // Newly translated department is now also cached
      expect(testCache.get(FIXTURES.hash, 'department')).toBe(FIXTURES.deptEn);
    });

    it('ensures changing content hash invalidates cache hit and triggers fresh API translation', async () => {
      const hash1 = 'hash-v1';
      const hash2 = 'hash-v2';

      testCache.set(hash1, 'title', FIXTURES.titleEn);
      mockSuccessfulApiResponse(['Updated Cloud Project Title']);

      const updatedProject: TranslatableProject = {
        contentHash: hash2,
        title: { th: 'โครงการพัฒนาระบบคลาวด์ (ปรับปรุงงบประมาณ)' },
      };

      const result = await service.translateProject(updatedProject);

      expect(mockTranslateText).toHaveBeenCalledTimes(1);
      expect(result.stats.translatedCount).toBe(1);
      expect(result.translations.title).toBe('Updated Cloud Project Title');
    });
  });

  describe('Handling Empty, Missing, and Already Translated Fields', () => {
    it('skips already translated fields without calling the Translation API', async () => {
      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: {
          th: FIXTURES.titleTh,
          en: FIXTURES.titleEn, // Already translated!
        },
        department: {
          th: FIXTURES.deptTh,
          en: FIXTURES.deptEn, // Already translated!
        },
      };

      const result = await service.translateProject(project);

      // Zero API calls made
      expect(mockTranslateText).not.toHaveBeenCalled();
      expect(result.stats.apiCalls).toBe(0);
      expect(result.stats.skippedCount).toBe(2);
      expect(result.stats.translatedCount).toBe(0);

      expect(result.updatedFields.title).toEqual({
        th: FIXTURES.titleTh,
        en: FIXTURES.titleEn,
      });
      expect(result.updatedFields.department).toEqual({
        th: FIXTURES.deptTh,
        en: FIXTURES.deptEn,
      });
    });

    it('skips empty, whitespace, and missing fields safely without API requests', async () => {
      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: '' }, // Empty
        department: { th: '   ' }, // Whitespace
      };

      const result = await service.translateProject(project);

      expect(mockTranslateText).not.toHaveBeenCalled();
      expect(result.stats.apiCalls).toBe(0);
      expect(result.stats.translatedCount).toBe(0);
      expect(result.stats.skippedCount).toBe(2);
    });

    it('handles mixed scenario: one already translated, one needing translation, one empty', async () => {
      mockSuccessfulApiResponse([FIXTURES.deptEn]);

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh, en: FIXTURES.titleEn }, // Already translated
        department: { th: FIXTURES.deptTh, en: '' }, // Needs translation
        description: { th: '' }, // Empty
      };

      const result = await service.translateProject(project);

      expect(mockTranslateText).toHaveBeenCalledTimes(1);
      expect(mockTranslateText.mock.calls[0][0].contents).toEqual([FIXTURES.deptTh]);

      expect(result.stats.translatedCount).toBe(1);
      expect(result.stats.skippedCount).toBe(2);
      expect(result.updatedFields.title?.en).toBe(FIXTURES.titleEn);
      expect(result.updatedFields.department?.en).toBe(FIXTURES.deptEn);
    });
  });

  describe('Translation Quality Validation Integration', () => {
    it('throws TranslationError when Google Translation API returns unchanged Thai text', async () => {
      // Mock API returning unchanged Thai text
      mockSuccessfulApiResponse([FIXTURES.titleTh]);

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh },
      };

      await expect(service.translateProject(project)).rejects.toThrow(TranslationError);
      await expect(service.translateProject(project)).rejects.toThrow(/validation failed/i);
    });

    it('throws TranslationError when Google Translation API returns an empty translation string', async () => {
      mockSuccessfulApiResponse(['']);

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh },
      };

      await expect(service.translateProject(project)).rejects.toThrow(TranslationError);
    });
  });

  describe('API Error Handling and Resilience', () => {
    it('handles API promise rejection (e.g. Quota Exceeded, 503 Unavailable) cleanly', async () => {
      mockTranslateText.mockRejectedValue(new Error('503 Service Unavailable: Rate limit exceeded'));

      const project: TranslatableProject = {
        contentHash: FIXTURES.hash,
        title: { th: FIXTURES.titleTh },
      };

      await expect(service.translateProject(project)).rejects.toThrow(TranslationError);
      await expect(service.translateProject(project)).rejects.toThrow(/Rate limit exceeded/);
    });

    it('handles malformed API response without translations array', async () => {
      // Mock API returning invalid object
      mockTranslateText.mockResolvedValue([{}]);

      await expect(service.translateBatch(['ข้อความ'])).rejects.toThrow(TranslationError);
      await expect(service.translateBatch(['ข้อความ'])).rejects.toThrow(/missing translations array/i);
    });

    it('handles malformed translation items missing translatedText', async () => {
      mockTranslateText.mockResolvedValue([
        {
          translations: [{ translatedText: null }],
        },
      ]);

      await expect(service.translateBatch(['ข้อความ'])).rejects.toThrow(TranslationError);
      await expect(service.translateBatch(['ข้อความ'])).rejects.toThrow(/Malformed translation entry/i);
    });

    it('handles empty translations array when input texts was non-empty', async () => {
      mockTranslateText.mockResolvedValue([
        {
          translations: [],
        },
      ]);

      await expect(service.translateBatch(['ข้อความ'])).rejects.toThrow(TranslationError);
      await expect(service.translateBatch(['ข้อความ'])).rejects.toThrow(/Empty translations returned/i);
    });
  });

  describe('Test Isolation and Cache Access', () => {
    it('returns internal cache instance with getCache()', () => {
      expect(service.getCache()).toBe(testCache);
    });

    it('maintains strict isolation between test executions with independent cache instances', () => {
      testCache.set('isolated-hash', 'title', 'Isolated Value');
      expect(testCache.get('isolated-hash', 'title')).toBe('Isolated Value');

      // Create new service with clean cache
      const cleanService = new AutoTranslationService({ cache: new TranslationCache() });
      expect(cleanService.getCache().get('isolated-hash', 'title')).toBeNull();
    });
  });
});

