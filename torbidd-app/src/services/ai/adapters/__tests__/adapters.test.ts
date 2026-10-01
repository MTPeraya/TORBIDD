// =============================================================================
// services/ai/adapters/__tests__/adapters.test.ts
// Unit tests for Multi-Backend AI Classifier Adapters (Google AI Studio, Vertex AI, OpenRouter)
// =============================================================================

import {
  GoogleAiStudioAdapter,
  VertexAiAdapter,
  OpenRouterAdapter,
  KeywordClassifierAdapter,
  getAiClassifierAdapter,
  normalizeProviderName,
} from '../index';

describe('AI Classifier Adapters', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Google AI Studio Adapter
  // ───────────────────────────────────────────────────────────────────────────
  describe('GoogleAiStudioAdapter', () => {
    it('reports not configured when apiKey is empty', () => {
      const adapter = new GoogleAiStudioAdapter({ apiKey: '' });
      expect(adapter.isConfigured()).toBe(false);
      expect(adapter.provider).toBe('google-ai-studio');
    });

    it('reports configured when apiKey is provided', () => {
      const adapter = new GoogleAiStudioAdapter({ apiKey: 'test-google-key' });
      expect(adapter.isConfigured()).toBe(true);
      expect(adapter.model).toBe('gemini-2.5-flash');
    });

    it('falls back to keyword classification when not configured', async () => {
      const adapter = new GoogleAiStudioAdapter({ apiKey: '' });
      const result = await adapter.classify(
        'พัฒนาระบบคลังข้อมูล Big Data',
        'ระบบ Data Analytics และ Data Warehouse สำหรับการวิเคราะห์ข้อมูล',
      );
      expect(result.category).toBe('Data Analytics');
      expect(result.isSoftwareRelated).toBe(true);
    });

    it('successfully classifies project via Google AI Studio API', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      category: 'Mobile App',
                      isSoftwareRelated: true,
                      confidence: 'High',
                      reasoning: 'iOS and Android application for BMA citizens',
                    }),
                  },
                ],
              },
            },
          ],
        }),
      });

      const adapter = new GoogleAiStudioAdapter({
        apiKey: 'test-google-key',
        model: 'gemini-2.5-flash',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'BMA Smart City App',
        'Mobile application for citizen complaints and notifications',
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0];
      expect(calledUrl).toContain('gemini-2.5-flash:generateContent');
      expect(calledUrl).toContain('key=test-google-key');

      expect(result.category).toBe('Mobile App');
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.confidence).toBe('High');
      expect(result.provider).toBe('google-ai-studio');
      expect(result.model).toBe('gemini-2.5-flash');
    });

    it('falls back gracefully on HTTP error status from Google AI Studio', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Resource has been exhausted (rate limit)',
      });

      const adapter = new GoogleAiStudioAdapter({
        apiKey: 'test-google-key',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'Website Redesign',
        'Portal for government public relations and online articles',
      );

      expect(result.category).toBe('Website');
      expect(result.isSoftwareRelated).toBe(true);
    });

    it('falls back gracefully on network or JSON parsing exception', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network connection reset'));

      const adapter = new GoogleAiStudioAdapter({
        apiKey: 'test-google-key',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'PostgreSQL Cluster Migration',
        'Database server infrastructure setup',
      );

      expect(result.category).toBe('Database');
      expect(result.isSoftwareRelated).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Vertex AI Adapter
  // ───────────────────────────────────────────────────────────────────────────
  describe('VertexAiAdapter', () => {
    it('reports not configured when GOOGLE_CLOUD_PROJECT is placeholder or unset', () => {
      delete process.env.GOOGLE_CLOUD_PROJECT;
      const adapter1 = new VertexAiAdapter();
      expect(adapter1.isConfigured()).toBe(false);

      process.env.GOOGLE_CLOUD_PROJECT = 'your-gcp-project-id';
      const adapter2 = new VertexAiAdapter();
      expect(adapter2.isConfigured()).toBe(false);
    });

    it('falls back to keyword classification when Vertex AI is not configured', async () => {
      delete process.env.GOOGLE_CLOUD_PROJECT;
      const adapter = new VertexAiAdapter();
      const result = await adapter.classify(
        'สร้างถนนคอนกรีตเสริมเหล็ก',
        'งานก่อสร้างและปรับปรุงทางหลวงท้องถิ่น',
      );
      expect(result.isSoftwareRelated).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. OpenRouter Adapter
  // ───────────────────────────────────────────────────────────────────────────
  describe('OpenRouterAdapter', () => {
    it('reports not configured when apiKey is empty', () => {
      const adapter = new OpenRouterAdapter({ apiKey: '' });
      expect(adapter.isConfigured()).toBe(false);
      expect(adapter.provider).toBe('openrouter');
    });

    it('reports configured when apiKey is provided', () => {
      const adapter = new OpenRouterAdapter({
        apiKey: 'sk-or-v1-testkey',
        model: 'qwen/qwen3.5-flash-02-23',
      });
      expect(adapter.isConfigured()).toBe(true);
      expect(adapter.model).toBe('qwen/qwen3.5-flash-02-23');
    });

    it('successfully classifies project via OpenRouter API', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  category: 'Cloud',
                  isSoftwareRelated: true,
                  confidence: 'High',
                  reasoning: 'Kubernetes container platform on cloud',
                }),
              },
            },
          ],
        }),
      });

      const adapter = new OpenRouterAdapter({
        apiKey: 'sk-or-v1-testkey',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'BMA Cloud Infrastructure',
        'Kubernetes container orchestration setup',
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.category).toBe('Cloud');
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.provider).toBe('openrouter');
    });

    it('falls back gracefully on OpenRouter network error', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('OpenRouter 502 Bad Gateway'));

      const adapter = new OpenRouterAdapter({
        apiKey: 'sk-or-v1-testkey',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'พัฒนาระบบ ERP บริหารจัดการบุคคล',
        'ระบบ payroll และ HR',
      );

      expect(result.category).toBe('ERP');
      expect(result.isSoftwareRelated).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Keyword Classifier Adapter
  // ───────────────────────────────────────────────────────────────────────────
  describe('KeywordClassifierAdapter', () => {
    it('is always configured and classifies accurately', async () => {
      const adapter = new KeywordClassifierAdapter();
      expect(adapter.isConfigured()).toBe(true);
      expect(adapter.name).toBe('KeywordFallbackAdapter');

      const result = await adapter.classify('Website Portal', 'E-government online portal');
      expect(result.category).toBe('Website');
      expect(result.isSoftwareRelated).toBe(true);

      const bulk = await adapter.classifyBulk([
        { title: 'App', description: 'iOS and Android mobile app' },
        { title: 'Road', description: 'Road construction' },
      ]);
      expect(bulk).toHaveLength(2);
      expect(bulk[0].category).toBe('Mobile App');
      expect(bulk[1].isSoftwareRelated).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Adapter Factory (getAiClassifierAdapter)
  // ───────────────────────────────────────────────────────────────────────────
  describe('getAiClassifierAdapter() Factory', () => {
    it('normalizes provider name aliases', () => {
      expect(normalizeProviderName('google-ai-studio')).toBe('google-ai-studio');
      expect(normalizeProviderName('gemini')).toBe('google-ai-studio');
      expect(normalizeProviderName('vertexai')).toBe('vertexai');
      expect(normalizeProviderName('vertex-ai')).toBe('vertexai');
      expect(normalizeProviderName('openrouter')).toBe('openrouter');
      expect(normalizeProviderName('open-router')).toBe('openrouter');
      expect(normalizeProviderName('keyword')).toBe('keyword');
    });

    it('returns KeywordClassifierAdapter when AI_TAGGING_ENABLED=false', () => {
      process.env.AI_TAGGING_ENABLED = 'false';
      process.env.AI_PROVIDER = 'google-ai-studio';
      process.env.GEMINI_API_KEY = 'test-key';

      const adapter = getAiClassifierAdapter();
      expect(adapter.provider).toBe('keyword');
    });

    it('returns GoogleAiStudioAdapter when AI_PROVIDER=google-ai-studio and key is set', () => {
      process.env.AI_TAGGING_ENABLED = 'true';
      process.env.AI_PROVIDER = 'google-ai-studio';
      process.env.GEMINI_API_KEY = 'test-gemini-key';

      const adapter = getAiClassifierAdapter();
      expect(adapter.provider).toBe('google-ai-studio');
      expect(adapter.isConfigured()).toBe(true);
    });

    it('returns OpenRouterAdapter when AI_PROVIDER=openrouter and key is set', () => {
      process.env.AI_TAGGING_ENABLED = 'true';
      process.env.AI_PROVIDER = 'openrouter';
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

      const adapter = getAiClassifierAdapter();
      expect(adapter.provider).toBe('openrouter');
      expect(adapter.isConfigured()).toBe(true);
    });

    it('falls back to KeywordClassifierAdapter when chosen provider key is missing', () => {
      process.env.AI_TAGGING_ENABLED = 'true';
      process.env.AI_PROVIDER = 'google-ai-studio';
      delete process.env.GEMINI_API_KEY;
      delete process.env.GOOGLE_AI_STUDIO_API_KEY;

      const adapter = getAiClassifierAdapter();
      expect(adapter.provider).toBe('keyword');
    });
  });
});
