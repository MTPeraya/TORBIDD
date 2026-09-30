// =============================================================================
// services/ai/adapters/google-ai-studio-adapter.ts
// Google AI Studio (Gemini REST API) Classifier Adapter (UC-10)
// =============================================================================

import { AiClassifierAdapter, ClassificationResult } from './types';
import { buildClassificationPrompt, parseAndValidateAiResponse } from './prompt';
import { classifyByKeywords } from './keyword-adapter';

export interface GoogleAiStudioAdapterOptions {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class GoogleAiStudioAdapter implements AiClassifierAdapter {
  public readonly name = 'GoogleAiStudioAdapter';
  public readonly provider = 'google-ai-studio';
  public readonly model: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  public constructor(options: GoogleAiStudioAdapterOptions = {}) {
    this.apiKey = (
      options.apiKey ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_AI_STUDIO_API_KEY ??
      ''
    ).trim();

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

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 0);
  }

  public async classify(title: string, description: string): Promise<ClassificationResult> {
    if (!this.isConfigured()) {
      return classifyByKeywords(title, description);
    }

    const prompt = buildClassificationPrompt(title, description);
    const endpoint = `${this.baseUrl}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`;

    const maxAttempts = 3;
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
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.warn(
            `[GoogleAiStudioAdapter] API returned HTTP ${response.status}: ${errorText.slice(0, 200)} — falling back to keyword classifier.`,
          );
          return classifyByKeywords(title, description);
        }

        const data = await response.json();
        const rawText =
          data?.candidates?.[0]?.content?.parts?.[0]?.text ??
          data?.candidates?.[0]?.text ??
          '';

        return parseAndValidateAiResponse(
          rawText,
          () => classifyByKeywords(title, description),
          { provider: this.provider, model: this.model },
        );
      } catch (err) {
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        console.warn(
          '[GoogleAiStudioAdapter] Request failed — falling back to keyword classifier:',
          err instanceof Error ? err.message : String(err),
        );
        return classifyByKeywords(title, description);
      }
    }

    return classifyByKeywords(title, description);
  }

  public async classifyBulk(
    projects: Array<{ title: string; description: string }>,
  ): Promise<ClassificationResult[]> {
    return Promise.all(projects.map((p) => this.classify(p.title, p.description)));
  }
}
