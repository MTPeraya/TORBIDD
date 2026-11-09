// =============================================================================
// services/ai/adapters/__tests__/fallback-adapter.test.ts
// Unit tests for FallbackClassifierAdapter (Rate-Limit Auto-Switching & Cooldowns)
// =============================================================================

import {
  FallbackClassifierAdapter,
  buildFallbackChain,
  resetProviderCooldowns,
  isProviderInCooldown,
  setProviderCooldown,
} from '../fallback-adapter';
import { GoogleAiStudioAdapter } from '../google-ai-studio-adapter';

describe('FallbackClassifierAdapter & Rate-Limit Switching', () => {
  beforeEach(() => {
    resetProviderCooldowns();
    jest.clearAllMocks();
  });

  afterAll(() => {
    resetProviderCooldowns();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Fallback Chain Ordering
  // ───────────────────────────────────────────────────────────────────────────
  describe('buildFallbackChain', () => {
    it('places Vertex AI as the last AI provider by default before keyword', () => {
      const chain = buildFallbackChain('google-ai-studio');
      expect(chain).toEqual(['google-ai-studio', 'openrouter', 'vertexai', 'keyword']);
      expect(chain[chain.length - 2]).toBe('vertexai');
      expect(chain[chain.length - 1]).toBe('keyword');
    });

    it('places Vertex AI as the last AI provider when primary is openrouter', () => {
      const chain = buildFallbackChain('openrouter');
      expect(chain).toEqual(['openrouter', 'google-ai-studio', 'vertexai', 'keyword']);
      expect(chain[chain.length - 2]).toBe('vertexai');
    });

    it('enforces Vertex AI as last AI provider even in custom ordering', () => {
      const custom = buildFallbackChain('google-ai-studio', [
        'vertexai',
        'openrouter',
        'google-ai-studio',
        'keyword',
      ]);
      expect(custom).toEqual(['openrouter', 'google-ai-studio', 'vertexai', 'keyword']);
      expect(custom[custom.length - 2]).toBe('vertexai');
      expect(custom[custom.length - 1]).toBe('keyword');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Cooldown Tracking
  // ───────────────────────────────────────────────────────────────────────────
  describe('Cooldown Management', () => {
    it('sets and checks cooldown status correctly', () => {
      expect(isProviderInCooldown('google-ai-studio')).toBe(false);

      setProviderCooldown('google-ai-studio', 'HTTP 429 Rate Limit', 1000);
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);

      resetProviderCooldowns();
      expect(isProviderInCooldown('google-ai-studio')).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Fallback on Rate Limit (HTTP 429)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Automatic Provider Switching on HTTP 429', () => {
    it('switches from rate-limited Google AI Studio to OpenRouter', async () => {
      // Mock fetch: first call (Google AI Studio) returns 429, second call (OpenRouter) succeeds
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Resource has been exhausted (rate limit)',
          };
        }
        if (url.includes('openrouter.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      category: 'Mobile App',
                      isSoftwareRelated: true,
                      confidence: 'High',
                      reasoning: 'Citizen mobile application',
                    }),
                  },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, text: async () => 'Unknown' };
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: {
          apiKey: 'test-gemini-key',
        },
        openrouterOptions: {
          apiKey: 'test-openrouter-key',
        },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'BMA Citizen Mobile App',
        'Mobile application for municipal public service delivery',
      );

      // Verify OpenRouter was called after Google AI Studio hit 429
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.category).toBe('Mobile App');
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryProviderFailed).toBe('google-ai-studio');

      // Verify Google AI Studio is now in cooldown
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);

      // Subsequent call should skip Google AI Studio directly and use OpenRouter
      mockFetch.mockClear();
      await adapter.classify('Another App', 'App description');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toContain('openrouter.ai');
    });

    it('switches to Vertex AI as the last AI provider when OpenRouter also fails', async () => {
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Gemini 429 Rate Limit',
          };
        }
        if (url.includes('openrouter.ai')) {
          return {
            ok: false,
            status: 429,
            text: async () => 'OpenRouter 429 Quota Exceeded',
          };
        }
        return { ok: false, status: 500, text: async () => 'Error' };
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKey: 'test-gemini-key' },
        openrouterOptions: { apiKey: 'test-openrouter-key' },
        // Vertex AI not configured with project in test, will fall back to keyword
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'จ้างพัฒนาระบบคลังข้อมูล Big Data Analytics',
        'Data analytics and business intelligence',
      );

      // Fallback chain reaches KeywordClassifierAdapter safely
      expect(result.category).toBe('Data Analytics');
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryProviderFailed).toBe('google-ai-studio');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Dynamic Provider Switching ("that can switch")
  // ───────────────────────────────────────────────────────────────────────────
  describe('Manual / Runtime Provider Switching', () => {
    it('switches active preferred provider at runtime', () => {
      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
      });

      adapter.switchActiveProvider('openrouter');
      expect(adapter.getFallbackChain()).toEqual([
        'google-ai-studio',
        'openrouter',
        'vertexai',
        'keyword',
      ]);
    });

    it('returns diagnostic status with Vertex AI marked as last AI provider', () => {
      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKey: 'test-key' },
      });

      const diagnostics = adapter.getDiagnostics();
      expect(diagnostics).toHaveLength(4);

      const vertexDiag = diagnostics.find((d) => d.provider === 'vertexai');
      expect(vertexDiag).toBeDefined();
      expect(vertexDiag?.isLastAiFallback).toBe(true);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Google AI Studio Multi-Key Rotation
  // ───────────────────────────────────────────────────────────────────────────
  describe('GoogleAiStudioAdapter Multi-Key Rotation', () => {
    it('rotates to key #2 when key #1 receives HTTP 429', async () => {
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('key=gemini-key-1')) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Key 1 exhausted',
          };
        }
        if (url.includes('key=gemini-key-2')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          category: 'Website',
                          isSoftwareRelated: true,
                          confidence: 'High',
                          reasoning: 'Web portal',
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, text: async () => 'Err' };
      });

      const adapter = new GoogleAiStudioAdapter({
        apiKeys: ['gemini-key-1', 'gemini-key-2'],
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      expect(adapter.getActiveKeyCount()).toBe(2);

      const result = await adapter.classify('Website Portal', 'Web system');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.category).toBe('Website');
      expect(result.isSoftwareRelated).toBe(true);
    });
  });
});
