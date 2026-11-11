/**
 * @jest-environment node
 */
// =============================================================================
// app/api/admin/translate/__tests__/route.test.ts
// Integration tests for /api/admin/translate administrative endpoint
// Validates request contracts, response payloads, status codes, and error responses.
// =============================================================================

import { NextRequest } from 'next/server';
import { GET, POST } from '../route';
import * as auth from '@/lib/auth';
import { defaultTranslationCache } from '@/services/translation/translation-cache';

// Mock TranslationServiceClient so no real Google Cloud API calls ever occur
const mockTranslateText = jest.fn();

jest.mock('@google-cloud/translate', () => {
  return {
    TranslationServiceClient: jest.fn().mockImplementation(() => {
      return {
        translateText: mockTranslateText,
      };
    }),
  };
});

// Mock authentication module
jest.mock('@/lib/auth', () => {
  const actual = jest.requireActual('@/lib/auth');
  return {
    ...actual,
    getAuthSessionFromRequest: jest.fn(),
    isAdminUser: jest.fn(),
  };
});

describe('Administrative Translation Endpoint (/api/admin/translate)', () => {
  const adminUser: auth.AuthSessionUser = {
    id: 'admin-123',
    email: 'admin@bma.go.th',
    name: 'BMA Administrator',
    picture: 'https://example.com/avatar.png',
    role: 'admin',
    org: 'BMA',
  };

  const regularUser: auth.AuthSessionUser = {
    id: 'user-456',
    email: 'officer@bma.go.th',
    name: 'Procurement Officer',
    picture: 'https://example.com/avatar.png',
    role: 'user',
    org: 'BMA',
  };

  function createPostRequest(body: unknown, isMalformedJson = false) {
    if (isMalformedJson) {
      return new NextRequest('http://localhost:3000/api/admin/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json-{missing-brackets',
      });
    }

    return new NextRequest('http://localhost:3000/api/admin/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  function mockSuccessfulTranslation(texts: string[]) {
    mockTranslateText.mockResolvedValue([
      {
        translations: texts.map((t) => ({ translatedText: t })),
      },
    ]);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockTranslateText.mockReset();
    defaultTranslationCache.clear();

    // Default: Authenticated as Admin
    (auth.getAuthSessionFromRequest as jest.Mock).mockReturnValue(adminUser);
    (auth.isAdminUser as jest.Mock).mockReturnValue(true);
  });

  describe('Authentication & Authorization Guards', () => {
    it('returns 403 Forbidden when request is unauthenticated', async () => {
      (auth.getAuthSessionFromRequest as jest.Mock).mockReturnValue(null);
      (auth.isAdminUser as jest.Mock).mockReturnValue(false);

      const req = createPostRequest({ text: 'ทดสอบ' });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toMatch(/Forbidden/i);
      expect(mockTranslateText).not.toHaveBeenCalled();
    });

    it('returns 403 Forbidden when user does not have admin role', async () => {
      (auth.getAuthSessionFromRequest as jest.Mock).mockReturnValue(regularUser);
      (auth.isAdminUser as jest.Mock).mockReturnValue(false);

      const req = createPostRequest({ text: 'ทดสอบ' });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toMatch(/Forbidden/i);
      expect(mockTranslateText).not.toHaveBeenCalled();
    });

    it('returns 403 Forbidden on GET when user is not admin', async () => {
      (auth.getAuthSessionFromRequest as jest.Mock).mockReturnValue(regularUser);
      (auth.isAdminUser as jest.Mock).mockReturnValue(false);

      const req = new NextRequest('http://localhost:3000/api/admin/translate');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.error).toMatch(/Forbidden/i);
    });
  });

  describe('Request Validation & Error Responses', () => {
    it('returns 400 Bad Request for malformed JSON request body', async () => {
      const req = createPostRequest(null, true);
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toMatch(/Malformed JSON/i);
      expect(mockTranslateText).not.toHaveBeenCalled();
    });

    it('returns 400 Bad Request when missing all translatable content', async () => {
      const req = createPostRequest({});
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toMatch(/Missing required translatable content/i);
      expect(json.code).toBe('MISSING_TRANSLATABLE_CONTENT');
      expect(mockTranslateText).not.toHaveBeenCalled();
    });

    it('returns 400 Bad Request when unsupported source or target languages are requested', async () => {
      const req = createPostRequest({
        text: 'Bonjour',
        sourceLanguage: 'fr',
        targetLanguage: 'de',
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toMatch(/Unsupported language pair/i);
      expect(json.code).toBe('UNSUPPORTED_LANGUAGE');
      expect(mockTranslateText).not.toHaveBeenCalled();
    });

    it('returns 400 Bad Request for action="validate" when missing sourceText or translatedText', async () => {
      const req = createPostRequest({
        action: 'validate',
        sourceText: 'ข้อความภาษาไทย',
        // translatedText is omitted
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.error).toMatch(/requires both sourceText and translatedText/i);
      expect(json.code).toBe('MISSING_VALIDATION_FIELDS');
    });
  });

  describe('Successful Translation Operations', () => {
    it('translates single text successfully with 200 status code', async () => {
      mockSuccessfulTranslation(['Bangkok Cloud Infrastructure Project']);

      const req = createPostRequest({
        text: 'โครงการระบบคลาวด์ กทม.',
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.translatedText).toBe('Bangkok Cloud Infrastructure Project');
      expect(json.data.cached).toBe(false);
      expect(mockTranslateText).toHaveBeenCalledTimes(1);
    });

    it('translates batch array of texts successfully', async () => {
      const thaiTexts = ['ข้อความที่หนึ่ง', 'ข้อความที่สอง'];
      const englishTexts = ['First sentence', 'Second sentence'];
      mockSuccessfulTranslation(englishTexts);

      const req = createPostRequest({
        texts: thaiTexts,
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.translations).toEqual(englishTexts);
      expect(json.data.count).toBe(2);
      expect(mockTranslateText).toHaveBeenCalledTimes(1);
    });

    it('translates key-value translatable fields object', async () => {
      mockSuccessfulTranslation([
        'Smart Drainage System',
        'Department of Drainage and Sewerage',
      ]);

      const req = createPostRequest({
        fields: {
          title: 'ระบบระบายน้ำอัจฉริยะ',
          department: 'สำนักการระบายน้ำ',
        },
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.translations.title).toBe('Smart Drainage System');
      expect(json.data.translations.department).toBe('Department of Drainage and Sewerage');
      expect(json.data.updatedFields.title).toEqual({
        th: 'ระบบระบายน้ำอัจฉริยะ',
        en: 'Smart Drainage System',
      });
    });

    it('translates full project structure and preserves original Thai source', async () => {
      mockSuccessfulTranslation([
        'AI Traffic Optimization Platform',
        'Traffic and Transportation Department',
      ]);

      const req = createPostRequest({
        project: {
          externalProjectId: '67119538991',
          projectName: 'ระบบ AI ควบคุมสัญญาณไฟจราจรอัจฉริยะ',
          agencyName: 'สำนักการจราจรและขนส่ง',
        },
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.translations.title).toBe('AI Traffic Optimization Platform');
      expect(json.data.translations.department).toBe('Traffic and Transportation Department');
      expect(json.data.updatedFields.title.th).toBe('ระบบ AI ควบคุมสัญญาณไฟจราจรอัจฉริยะ');
      expect(json.data.updatedFields.projectNameEn).toBe('AI Traffic Optimization Platform');
    });
  });

  describe('Quality Validation Action (action="validate")', () => {
    it('returns validation success for acceptable English translation', async () => {
      const req = createPostRequest({
        action: 'validate',
        sourceText: 'ระบบจัดเก็บข้อมูล กทม.',
        translatedText: 'BMA Data Storage System',
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.validation.isValid).toBe(true);
      expect(json.data.validation.code).toBe('OK');
      expect(mockTranslateText).not.toHaveBeenCalled();
    });

    it('identifies unchanged Thai translation as validation failure', async () => {
      const req = createPostRequest({
        action: 'validate',
        sourceText: 'ระบบจัดเก็บข้อมูล กทม.',
        translatedText: 'ระบบจัดเก็บข้อมูล กทม.', // Unchanged Thai
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.validation.isValid).toBe(false);
      expect(json.data.validation.code).toBe('UNCHANGED_THAI');
    });
  });

  describe('Cache Management Action (action="clear-cache")', () => {
    it('clears the translation cache and returns success status', async () => {
      defaultTranslationCache.set('test-hash', 'title', 'Cached Title');
      expect(defaultTranslationCache.size()).toBe(1);

      const req = createPostRequest({
        action: 'clear-cache',
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.cacheSize).toBe(0);
      expect(defaultTranslationCache.size()).toBe(0);
      expect(mockTranslateText).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling on Service Failures', () => {
    it('returns 502/500 error contract when Google Cloud API fails', async () => {
      mockTranslateText.mockRejectedValue(new Error('Quota exceeded for project'));

      const req = createPostRequest({
        text: 'ข้อความทดสอบ',
      });
      const res = await POST(req);
      const json = await res.json();

      expect(res.status).toBe(502);
      expect(json.error).toMatch(/Quota exceeded/i);
      expect(json.code).toBe('API_FAILURE');
    });
  });

  describe('GET /api/admin/translate Status Inspection', () => {
    it('returns service health, cache statistics, and supported languages for admin', async () => {
      defaultTranslationCache.set('hash-1', 'title', 'Title 1');

      const req = new NextRequest('http://localhost:3000/api/admin/translate');
      const res = await GET(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('healthy');
      expect(json.data.cacheSize).toBe(1);
      expect(json.data.supportedLanguages).toEqual({
        source: 'th',
        target: 'en',
      });
    });
  });
});

