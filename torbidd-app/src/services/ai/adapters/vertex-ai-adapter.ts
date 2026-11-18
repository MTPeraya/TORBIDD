// =============================================================================
// services/ai/adapters/vertex-ai-adapter.ts
// Google Cloud Vertex AI Gemini Classifier Adapter (UC-10)
// =============================================================================

import {
  AiClassifierAdapter,
  ClassificationResult,
  AiRateLimitError,
  AiProviderError,
} from './types';
import { buildClassificationPrompt, parseAndValidateAiResponse } from './prompt';
import { classifyByKeywords } from './keyword-adapter';
import { getVertexAI, VERTEX_MODEL_FLASH, withTimeout } from '../vertex-ai';

export interface VertexAiAdapterOptions {
  model?: string;
  disableKeywordFallback?: boolean;
}

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10_000,
  operationName: string = 'Vertex AI prompt classification',
): Promise<T> {
  if (typeof withTimeout === 'function') {
    return withTimeout(promise, timeoutMs, operationName);
  }
  return promise;
}

export class VertexAiAdapter implements AiClassifierAdapter {
  public readonly name = 'VertexAiAdapter';
  public readonly provider = 'vertexai';
  public readonly model: string;
  public readonly disableKeywordFallback: boolean;

  public constructor(options: VertexAiAdapterOptions = {}) {
    this.model = options.model ?? process.env.VERTEX_AI_MODEL ?? VERTEX_MODEL_FLASH;
    this.disableKeywordFallback = options.disableKeywordFallback ?? false;
  }

  public isConfigured(): boolean {
    const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
    return Boolean(project && project !== 'your-gcp-project-id' && project.length > 0);
  }

  public async classify(title: string, description: string): Promise<ClassificationResult> {
    if (!this.isConfigured()) {
      if (this.disableKeywordFallback) {
        throw new AiProviderError(this.provider, 'Google Cloud Project not configured for Vertex AI');
      }
      return classifyByKeywords(title, description);
    }

    try {
      const vertexAI = getVertexAI();
      const generativeModel = vertexAI.getGenerativeModel({ model: this.model });

      const prompt = buildClassificationPrompt(title, description);
      // ASVS V15.1.3 & V15.2.2: Enforce 10s execution timeout on Vertex AI prompt calls
      const result = await runWithTimeout(
        generativeModel.generateContent(prompt),
        10_000,
        'Vertex AI prompt classification',
      );
      const rawText = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      return parseAndValidateAiResponse(
        rawText,
        () => {
          if (this.disableKeywordFallback) {
            throw new AiProviderError(this.provider, 'Invalid JSON returned by Vertex AI');
          }
          return classifyByKeywords(title, description);
        },
        { provider: this.provider, model: this.model },
      );
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isRateLimit =
        errMsg.includes('429') ||
        errMsg.toLowerCase().includes('quota') ||
        errMsg.toLowerCase().includes('resource has been exhausted');

      if (this.disableKeywordFallback) {
        if (isRateLimit) {
          throw new AiRateLimitError(this.provider, errMsg, 60000);
        }
        throw new AiProviderError(this.provider, errMsg);
      }

      console.warn(
        '[VertexAiAdapter] Classification failed — falling back to keyword classifier:',
        errMsg,
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
