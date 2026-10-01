// =============================================================================
// services/ai/adapters/index.ts
// AI Classification Adapter Factory & Registry (UC-10)
// Supports: Google AI Studio, Vertex AI, OpenRouter, and Keyword Fallback
// =============================================================================

import { AiClassifierAdapter, AiProvider } from './types';
import { KeywordClassifierAdapter } from './keyword-adapter';
import { GoogleAiStudioAdapter } from './google-ai-studio-adapter';
import { VertexAiAdapter } from './vertex-ai-adapter';
import { OpenRouterAdapter } from './openrouter-adapter';

export * from './types';
export * from './prompt';
export { KeywordClassifierAdapter, classifyByKeywords } from './keyword-adapter';
export { GoogleAiStudioAdapter } from './google-ai-studio-adapter';
export { VertexAiAdapter } from './vertex-ai-adapter';
export { OpenRouterAdapter } from './openrouter-adapter';

export interface GetAdapterOptions {
  provider?: string;
  apiKey?: string;
  model?: string;
  forceKeyword?: boolean;
}

/**
 * Normalizes user/env provider string into canonical AiProvider
 */
export function normalizeProviderName(rawProvider?: string): AiProvider {
  const norm = (rawProvider || '').trim().toLowerCase().replace(/[_\s]/g, '-');
  if (norm === 'google-ai-studio' || norm === 'gemini' || norm === 'google') {
    return 'google-ai-studio';
  }
  if (norm === 'vertexai' || norm === 'vertex-ai' || norm === 'vertex' || norm === 'gcp') {
    return 'vertexai';
  }
  if (norm === 'openrouter' || norm === 'open-router') {
    return 'openrouter';
  }
  if (norm === 'keyword' || norm === 'rule-based' || norm === 'fallback') {
    return 'keyword';
  }
  return 'google-ai-studio'; // default preferred provider
}

/**
 * Factory that returns the appropriate AI classifier adapter.
 * Respects AI_TAGGING_ENABLED master toggle.
 */
export function getAiClassifierAdapter(options: GetAdapterOptions = {}): AiClassifierAdapter {
  // 1. Check master switch
  const taggingEnabled = process.env.AI_TAGGING_ENABLED !== 'false';
  if (!taggingEnabled || options.forceKeyword) {
    return new KeywordClassifierAdapter();
  }

  // 2. Resolve provider
  const rawProvider = options.provider ?? process.env.AI_PROVIDER;
  let resolvedProvider: AiProvider;

  if (rawProvider) {
    resolvedProvider = normalizeProviderName(rawProvider);
  } else if (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_STUDIO_API_KEY) {
    resolvedProvider = 'google-ai-studio';
  } else if (process.env.OPENROUTER_API_KEY) {
    resolvedProvider = 'openrouter';
  } else if (
    process.env.GOOGLE_CLOUD_PROJECT &&
    process.env.GOOGLE_CLOUD_PROJECT !== 'your-gcp-project-id'
  ) {
    resolvedProvider = 'vertexai';
  } else {
    resolvedProvider = 'keyword';
  }

  // 3. Instantiate requested adapter
  switch (resolvedProvider) {
    case 'google-ai-studio': {
      const adapter = new GoogleAiStudioAdapter({
        apiKey: options.apiKey,
        model: options.model,
      });
      return adapter.isConfigured() ? adapter : new KeywordClassifierAdapter();
    }

    case 'vertexai': {
      const adapter = new VertexAiAdapter({
        model: options.model,
      });
      return adapter.isConfigured() ? adapter : new KeywordClassifierAdapter();
    }

    case 'openrouter': {
      const adapter = new OpenRouterAdapter({
        apiKey: options.apiKey,
        model: options.model,
      });
      return adapter.isConfigured() ? adapter : new KeywordClassifierAdapter();
    }

    case 'keyword':
    default:
      return new KeywordClassifierAdapter();
  }
}
