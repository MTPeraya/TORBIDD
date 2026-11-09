// =============================================================================
// services/ai/adapters/google-ai-studio-adapter.ts
// Google AI Studio (Gemini REST API) Classifier Adapter (UC-10)
// =============================================================================

import {
  AiClassifierAdapter,
  ClassificationResult,
  AiRateLimitError,
  AiProviderError,
} from './types';
import { buildClassificationPrompt, parseAndValidateAiResponse } from './prompt';
import { classifyByKeywords } from './keyword-adapter';

export interface GoogleAiStudioAdapterOptions {
  apiKey?: string;
  apiKeys?: string[];
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  disableKeywordFallback?: boolean;
}

export class GoogleAiStudioAdapter implements AiClassifierAdapter {
  public readonly name = 'GoogleAiStudioAdapter';
  public readonly provider = 'google-ai-studio';
  public readonly model: string;
  public readonly disableKeywordFallback: boolean;

  private readonly apiKeys: string[];
  private currentKeyIndex = 0;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(options: GoogleAiStudioAdapterOptions = {}) {
    const rawKeysInput =
      options.apiKeys ??
      (options.apiKey
        ? [options.apiKey]
        : (process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY || '')
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean));

    this.apiKeys = rawKeysInput.map((k) => k.trim()).filter(Boolean);
    this.disableKeywordFallback = options.disableKeywordFallback ?? false;

    const rawModel = (
      options.model ??
      process.env.GEMINI_MODEL ??
      'gemini-2.5-flash'
    ).trim();

    // Map deprecated Gemini models to active gemini-2.5-flash
    if (rawModel === 'gemini-2.0-flash' || rawModel === 'gemini-1.5-flash' || rawModel === 'gemini-1.5-pro') {
      this.model = 'gemini-2.5-flash';
    } else {
      this.model = rawModel;
    }

    this.baseUrl = (
      options.baseUrl ??
      'https://generativelanguage.googleapis.com/v1beta/models'
    ).replace(/\/+$/, '');

    this.fetchImpl =
      options.fetchImpl ??
      (typeof fetch !== 'undefined'
        ? fetch
        : ((globalThis as unknown as { fetch?: typeof fetch }).fetch as typeof fetch));
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  public get apiKey(): string {
    return this.apiKeys[this.currentKeyIndex] || '';
  }

  public isConfigured(): boolean {
    return this.apiKeys.length > 0 && this.apiKeys.some((k) => k.length > 0);
  }

  public getActiveKeyCount(): number {
    return this.apiKeys.length;
  }

  public rotateKey(): boolean {
    if (this.apiKeys.length <= 1) return false;
    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
    console.warn(`[GoogleAiStudioAdapter] Switched to Gemini API key #${this.currentKeyIndex + 1}/${this.apiKeys.length}`);
    return true;
  }

  public async classify(title: string, description: string): Promise<ClassificationResult> {
    if (!this.isConfigured()) {
      if (this.disableKeywordFallback) {
        throw new AiProviderError(this.provider, 'No Gemini API key configured');
      }
      return classifyByKeywords(title, description);
    }

    const prompt = buildClassificationPrompt(title, description);
    const totalKeys = Math.max(1, this.apiKeys.length);
    let lastError: Error | null = null;

    // Try keys sequentially if rate-limited
    for (let keyAttempt = 0; keyAttempt < totalKeys; keyAttempt++) {
      const activeKey = this.apiKey;
      const endpoint = `${this.baseUrl}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(activeKey)}`;

      const maxAttempts = 2;
      let hit429OnKey = false;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await this.fetchImpl(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [{ text: prompt }],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            }),
            signal: AbortSignal.timeout(this.timeoutMs),
          });

          if (response.status === 503 && attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
            continue;
          }

          if (response.status === 429) {
            hit429OnKey = true;
            const errorText = await response.text().catch(() => '');
            lastError = new AiRateLimitError(this.provider, `HTTP 429: ${errorText.slice(0, 200)}`, 60000);
            console.warn(
              `[GoogleAiStudioAdapter] Key #${this.currentKeyIndex + 1} hit rate limit (HTTP 429).`,
            );
            break; // Break out to rotate key or throw
          }

          if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            lastError = new AiProviderError(this.provider, errorText.slice(0, 200), response.status);
            console.warn(
              `[GoogleAiStudioAdapter] API returned HTTP ${response.status}: ${errorText.slice(0, 200)}`,
            );
            if (this.disableKeywordFallback) {
              throw lastError;
            }
            return classifyByKeywords(title, description);
          }

          const data = await response.json();
          const rawText =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ??
            data?.candidates?.[0]?.text ??
            '';

          return parseAndValidateAiResponse(
            rawText,
            () => {
              if (this.disableKeywordFallback) {
                throw new AiProviderError(this.provider, 'Invalid JSON returned by Gemini API');
              }
              return classifyByKeywords(title, description);
            },
            { provider: this.provider, model: this.model },
          );
        } catch (err) {
          if (err instanceof AiRateLimitError || err instanceof AiProviderError) {
            throw err;
          }
          if (attempt < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 600));
            continue;
          }
          lastError = err instanceof Error ? err : new Error(String(err));
        }
      }

      if (hit429OnKey && keyAttempt < totalKeys - 1) {
        this.rotateKey();
        continue;
      }
    }

    if (this.disableKeywordFallback) {
      if (lastError instanceof AiRateLimitError) {
        throw lastError;
      }
      throw new AiRateLimitError(
        this.provider,
        lastError?.message || 'Gemini API rate limit exceeded across all configured keys',
        60000,
      );
    }

    console.warn(
      '[GoogleAiStudioAdapter] Rate limited or failed — falling back to keyword classifier:',
      lastError?.message || 'Unknown error',
    );
    return classifyByKeywords(title, description);
  }

  public async classifyBulk(
    projects: Array<{ title: string; description: string }>,
  ): Promise<ClassificationResult[]> {
    return Promise.all(projects.map((p) => this.classify(p.title, p.description)));
  }
}
