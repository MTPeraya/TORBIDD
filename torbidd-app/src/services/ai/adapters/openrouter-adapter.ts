// =============================================================================
// services/ai/adapters/openrouter-adapter.ts
// OpenRouter Multi-Model Classifier Adapter (UC-10)
// =============================================================================

import { AiClassifierAdapter, ClassificationResult } from './types';
import { buildClassificationPrompt, parseAndValidateAiResponse } from './prompt';
import { classifyByKeywords } from './keyword-adapter';

export interface OpenRouterAdapterOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class OpenRouterAdapter implements AiClassifierAdapter {
  public readonly name = 'OpenRouterAdapter';
  public readonly provider = 'openrouter';
  public readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(options: OpenRouterAdapterOptions = {}) {
    this.apiKey = (options.apiKey ?? process.env.OPENROUTER_API_KEY ?? '').trim();
    this.model = (
      options.model ??
      process.env.OPENROUTER_MODEL ??
      'qwen/qwen3.5-flash-02-23'
    ).trim();

    this.baseUrl = (
      options.baseUrl ??
      process.env.OPENROUTER_BASE_URL ??
      'https://openrouter.ai/api/v1'
    ).replace(/\/+$/, '');

    this.fetchImpl =
      options.fetchImpl ??
      (typeof fetch !== 'undefined'
        ? fetch
        : ((globalThis as unknown as { fetch?: typeof fetch }).fetch as typeof fetch));
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public async classify(title: string, description: string): Promise<ClassificationResult> {
    if (!this.isConfigured()) {
      return classifyByKeywords(title, description);
    }

    const prompt = buildClassificationPrompt(title, description);
    const endpoint = `${this.baseUrl}/chat/completions`;
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';

    try {
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': appUrl,
          'X-Title': 'TORBIDD Procurement Classification',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert government procurement classification system. You must reply ONLY with valid JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.warn(
          `[OpenRouterAdapter] API returned HTTP ${response.status}: ${errorText.slice(0, 200)} — falling back to keyword classifier.`,
        );
        return classifyByKeywords(title, description);
      }

      const data = await response.json();
      const rawText = data?.choices?.[0]?.message?.content ?? '';

      return parseAndValidateAiResponse(
        rawText,
        () => classifyByKeywords(title, description),
        { provider: this.provider, model: this.model },
      );
    } catch (err) {
      console.warn(
        '[OpenRouterAdapter] Request failed — falling back to keyword classifier:',
        err instanceof Error ? err.message : String(err),
      );
      return classifyByKeywords(title, description);
    }
  }

  public async classifyBulk(
    projects: Array<{ title: string; description: string }>,
  ): Promise<ClassificationResult[]> {
    return Promise.all(projects.map((p) => this.classify(p.title, p.description)));
  }
}
