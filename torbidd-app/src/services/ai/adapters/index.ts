import { AiClassifierAdapter, AiProvider } from './types';
import { KeywordClassifierAdapter } from './keyword-adapter';
import { GoogleAiStudioAdapter } from './google-ai-studio-adapter';
import { VertexAiAdapter } from './vertex-ai-adapter';
import { OpenRouterAdapter } from './openrouter-adapter';
import {
  FallbackClassifierAdapter,
  FallbackAdapterOptions,
  buildFallbackChain,
  resetProviderCooldowns,
  isProviderInCooldown,
  setProviderCooldown,
} from './fallback-adapter';

export * from './types';
export * from './prompt';
export { KeywordClassifierAdapter, classifyByKeywords } from './keyword-adapter';
export { GoogleAiStudioAdapter } from './google-ai-studio-adapter';
export { VertexAiAdapter } from './vertex-ai-adapter';
export { OpenRouterAdapter } from './openrouter-adapter';
export {
  FallbackClassifierAdapter,
  buildFallbackChain,
  resetProviderCooldowns,
  isProviderInCooldown,
  setProviderCooldown,
};
export type { FallbackAdapterOptions };

export interface GetAdapterOptions {
  provider?: string;
  apiKey?: string;
  model?: string;
  forceKeyword?: boolean;
  disableFallback?: boolean;
  fallbackOrder?: AiProvider[];
  singleProviderOnly?: boolean;
  cooldownMs?: number;
  fetchImpl?: typeof fetch;
}

// Global active fallback adapter singleton instance to preserve cooldown state and provider switching
let globalFallbackAdapter: FallbackClassifierAdapter | null = null;

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
  if (norm === 'fallback' || norm === 'auto' || norm === 'chain' || norm === 'multi') {
    return 'fallback';
  }
  if (norm === 'keyword' || norm === 'rule-based') {
    return 'keyword';
  }
  return 'google-ai-studio'; // default preferred provider
}

/**
 * Switch the active preferred AI provider at runtime ("that can switch")
 */
export function switchActiveAiProvider(provider: AiProvider): void {
  if (globalFallbackAdapter) {
    globalFallbackAdapter.switchActiveProvider(provider);
  }
}

/**
 * Get active provider diagnostics
 */
export function getAiDiagnostics() {
  const adapter = getAiClassifierAdapter();
  if (adapter instanceof FallbackClassifierAdapter) {
    return adapter.getDiagnostics();
  }
  return [];
}

/**
 * Factory that returns the appropriate AI classifier adapter.
 * Uses FallbackClassifierAdapter by default with automatic switching on 429/failures,
 * ensuring Vertex AI is strictly the last AI provider in the chain.
 * Respects AI_TAGGING_ENABLED master toggle.
 */
export function getAiClassifierAdapter(options: GetAdapterOptions = {}): AiClassifierAdapter {
  // 1. Check master switch
  const taggingEnabled = process.env.AI_TAGGING_ENABLED !== 'false';
  if (!taggingEnabled || options.forceKeyword) {
    return new KeywordClassifierAdapter();
  }

  // 2. Resolve preferred provider
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

  // 3. If caller explicitly requested single provider without fallback
  if (options.singleProviderOnly || options.disableFallback) {
    switch (resolvedProvider) {
      case 'google-ai-studio': {
        const adapter = new GoogleAiStudioAdapter({
          apiKey: options.apiKey,
          model: options.model,
          fetchImpl: options.fetchImpl,
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
          fetchImpl: options.fetchImpl,
        });
        return adapter.isConfigured() ? adapter : new KeywordClassifierAdapter();
      }
      case 'keyword':
      default:
        return new KeywordClassifierAdapter();
    }
  }

  // 4. Return FallbackClassifierAdapter (with auto-switching, 429 rate limit cooldown, and Vertex AI last)
  const adapter = new FallbackClassifierAdapter({
    primaryProvider: resolvedProvider,
    fallbackOrder: options.fallbackOrder,
    cooldownMs: options.cooldownMs,
    fetchImpl: options.fetchImpl,
    googleOptions: {
      apiKey: options.apiKey,
      model: options.model,
    },
    openrouterOptions: {
      apiKey: options.apiKey,
      model: options.model,
    },
    vertexOptions: {
      model: options.model,
    },
  });

  globalFallbackAdapter = adapter;
  return adapter;
}
