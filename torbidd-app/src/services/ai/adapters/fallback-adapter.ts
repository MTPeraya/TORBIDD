// =============================================================================
// services/ai/adapters/fallback-adapter.ts
// Fallback & Auto-Switching AI Classifier Adapter (UC-10)
//
// Automatically switches AI backends upon Rate Limits (HTTP 429) or failures,
// guaranteeing that Google Cloud Vertex AI is the last AI provider in the chain
// before rule-based keyword classification.
// =============================================================================

import {
  AiClassifierAdapter,
  AiProvider,
  ClassificationResult,
  AiRateLimitError,
} from './types';
import { GoogleAiStudioAdapter, GoogleAiStudioAdapterOptions } from './google-ai-studio-adapter';
import { OpenRouterAdapter, OpenRouterAdapterOptions } from './openrouter-adapter';
import { VertexAiAdapter, VertexAiAdapterOptions } from './vertex-ai-adapter';
import { KeywordClassifierAdapter } from './keyword-adapter';

export interface ProviderCooldownInfo {
  inCooldownUntil: number;
  reason: string;
  errorCount: number;
  lastErrorAt: number;
}

export interface ProviderDiagnosticStatus {
  provider: AiProvider;
  name: string;
  configured: boolean;
  inCooldown: boolean;
  cooldownRemainingSeconds: number;
  errorCount: number;
  lastErrorReason?: string;
  isLastAiFallback: boolean;
}

export interface FallbackAdapterOptions {
  primaryProvider?: AiProvider;
  fallbackOrder?: AiProvider[];
  cooldownMs?: number;
  googleOptions?: GoogleAiStudioAdapterOptions;
  openrouterOptions?: OpenRouterAdapterOptions;
  vertexOptions?: VertexAiAdapterOptions;
  fetchImpl?: typeof fetch;
}

// Global in-memory cooldown state across calls within the node process
const providerCooldowns = new Map<AiProvider, ProviderCooldownInfo>();

// Default rate-limit cooldown: 60 seconds (standard Gemini free tier RPM window)
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;
const DEFAULT_ERROR_COOLDOWN_MS = 15_000;

/**
 * Resets all provider cooldowns (e.g. for testing or administrative resets)
 */
export function resetProviderCooldowns(): void {
  providerCooldowns.clear();
}

/**
 * Checks whether a given provider is currently in cooldown
 */
export function isProviderInCooldown(provider: AiProvider): boolean {
  const info = providerCooldowns.get(provider);
  if (!info) return false;
  if (Date.now() >= info.inCooldownUntil) {
    providerCooldowns.delete(provider);
    return false;
  }
  return true;
}

/**
 * Sets cooldown on a provider
 */
export function setProviderCooldown(
  provider: AiProvider,
  reason: string,
  durationMs: number = DEFAULT_RATE_LIMIT_COOLDOWN_MS,
): void {
  const existing = providerCooldowns.get(provider);
  providerCooldowns.set(provider, {
    inCooldownUntil: Date.now() + durationMs,
    reason,
    errorCount: (existing?.errorCount ?? 0) + 1,
    lastErrorAt: Date.now(),
  });
}

/**
 * Builds the canonical fallback chain ensuring Vertex AI is strictly the LAST AI provider
 * before keyword fallback.
 */
export function buildFallbackChain(
  primaryProvider: AiProvider = 'google-ai-studio',
  customOrder?: AiProvider[],
): AiProvider[] {
  if (customOrder && customOrder.length > 0) {
    const list = [...customOrder];
    // Guarantee keyword is last
    const withoutKeyword = list.filter((p) => p !== 'keyword');
    // Guarantee vertexai is last among AI providers
    const withoutVertex = withoutKeyword.filter((p) => p !== 'vertexai');
    return [...withoutVertex, 'vertexai', 'keyword'];
  }

  // Canonical ordering based on user preference:
  // Requirement: "vertex ai to be the last" AI provider before keyword fallback
  switch (primaryProvider) {
    case 'openrouter':
      return ['openrouter', 'google-ai-studio', 'vertexai', 'keyword'];
    case 'vertexai':
      return ['vertexai', 'keyword'];
    case 'keyword':
      return ['keyword'];
    case 'google-ai-studio':
    case 'fallback':
    default:
      return ['google-ai-studio', 'openrouter', 'vertexai', 'keyword'];
  }
}

export class FallbackClassifierAdapter implements AiClassifierAdapter {
  public readonly name = 'FallbackClassifierAdapter';
  public readonly isFallbackAdapter = true;

  private activePrimaryProvider: AiProvider;
  private readonly cooldownMs: number;
  private readonly adapters: Map<AiProvider, AiClassifierAdapter> = new Map();
  private readonly chain: AiProvider[];

  public constructor(options: FallbackAdapterOptions = {}) {
    this.activePrimaryProvider = options.primaryProvider ?? 'google-ai-studio';
    this.cooldownMs = options.cooldownMs ?? DEFAULT_RATE_LIMIT_COOLDOWN_MS;

    // Instantiate adapters with disableKeywordFallback: true so FallbackClassifierAdapter
    // can catch rate limits and errors to switch providers seamlessly
    const google = new GoogleAiStudioAdapter({
      ...options.googleOptions,
      fetchImpl: options.fetchImpl,
      disableKeywordFallback: true,
    });

    const openrouter = new OpenRouterAdapter({
      ...options.openrouterOptions,
      fetchImpl: options.fetchImpl,
      disableKeywordFallback: true,
    });

    const vertex = new VertexAiAdapter({
      ...options.vertexOptions,
      disableKeywordFallback: true,
    });

    const keyword = new KeywordClassifierAdapter();

    this.adapters.set('google-ai-studio', google);
    this.adapters.set('openrouter', openrouter);
    this.adapters.set('vertexai', vertex);
    this.adapters.set('keyword', keyword);

    this.chain = buildFallbackChain(this.activePrimaryProvider, options.fallbackOrder);
  }

  /**
   * The effective current provider name (shows active primary or active switched provider)
   */
  public get provider(): string {
    const current = this.getActiveProvider();
    return current;
  }

  public get model(): string {
    const active = this.getActiveProvider();
    const adapter = this.adapters.get(active);
    return adapter?.model || 'rule-based-keywords';
  }

  public isConfigured(): boolean {
    // Always configured because keyword fallback is always available
    return true;
  }

  /**
   * Returns the currently active non-cooldown provider in the chain
   */
  public getActiveProvider(): AiProvider {
    for (const p of this.chain) {
      if (p === 'keyword') return 'keyword';
      const adapter = this.adapters.get(p);
      if (adapter && adapter.isConfigured() && !isProviderInCooldown(p)) {
        return p;
      }
    }
    return 'keyword';
  }

  /**
   * Switch the preferred primary provider dynamically at runtime ("that can switch")
   */
  public switchActiveProvider(newProvider: AiProvider): void {
    this.activePrimaryProvider = newProvider;
    console.info(`[AI Fallback] Switched active preferred provider to: ${newProvider}`);
  }

  /**
   * Get the ordered fallback sequence
   */
  public getFallbackChain(): AiProvider[] {
    return [...this.chain];
  }

  /**
   * Diagnostic status of all providers in the fallback chain
   */
  public getDiagnostics(): ProviderDiagnosticStatus[] {
    return this.chain.map((provider) => {
      const adapter = this.adapters.get(provider);
      const cooldownInfo = providerCooldowns.get(provider);
      const inCooldown = isProviderInCooldown(provider);
      const remainingMs =
        inCooldown && cooldownInfo ? Math.max(0, cooldownInfo.inCooldownUntil - Date.now()) : 0;

      return {
        provider,
        name: adapter?.name || provider,
        configured: adapter?.isConfigured() ?? false,
        inCooldown,
        cooldownRemainingSeconds: Math.ceil(remainingMs / 1000),
        errorCount: cooldownInfo?.errorCount ?? 0,
        lastErrorReason: cooldownInfo?.reason,
        isLastAiFallback: provider === 'vertexai',
      };
    });
  }

  public async classify(title: string, description: string): Promise<ClassificationResult> {
    let firstAttemptedProvider: AiProvider | null = null;
    const attemptedProviders: string[] = [];

    for (let i = 0; i < this.chain.length; i++) {
      const currentProvider = this.chain[i];
      const adapter = this.adapters.get(currentProvider);

      if (!adapter) continue;

      // Rule-based keyword fallback is always the final fallback
      if (currentProvider === 'keyword') {
        const result = await adapter.classify(title, description);
        if (firstAttemptedProvider) {
          return {
            ...result,
            fallbackUsed: true,
            primaryProviderFailed: firstAttemptedProvider,
          };
        }
        return result;
      }

      // Check if adapter is configured with valid credentials/project
      if (!adapter.isConfigured()) {
        continue;
      }

      // Check if provider is currently in cooldown from a prior rate limit (429)
      if (isProviderInCooldown(currentProvider)) {
        const info = providerCooldowns.get(currentProvider);
        const remSec = info ? Math.ceil((info.inCooldownUntil - Date.now()) / 1000) : 0;
        console.warn(
          `[AI Fallback] Skipping ${currentProvider} (in rate-limit cooldown for ${remSec}s, reason: ${info?.reason || 'Rate limited'}).`,
        );
        continue;
      }

      if (!firstAttemptedProvider) {
        firstAttemptedProvider = currentProvider;
      }
      attemptedProviders.push(currentProvider);

      try {
        const result = await adapter.classify(title, description);

        // If fallback was used from an earlier failure
        if (firstAttemptedProvider && firstAttemptedProvider !== currentProvider) {
          return {
            ...result,
            fallbackUsed: true,
            primaryProviderFailed: firstAttemptedProvider,
          };
        }
        return result;
      } catch (err) {
        const isRateLimit =
          err instanceof AiRateLimitError ||
          (err instanceof Error &&
            (err.message.includes('429') ||
              err.message.toLowerCase().includes('rate limit') ||
              err.message.toLowerCase().includes('quota') ||
              err.message.toLowerCase().includes('resource has been exhausted')));

        const cooldownDuration = isRateLimit ? this.cooldownMs : DEFAULT_ERROR_COOLDOWN_MS;
        const reason = isRateLimit
          ? 'HTTP 429 Rate Limit Exceeded'
          : err instanceof Error
            ? err.message.slice(0, 150)
            : 'Unknown provider failure';

        setProviderCooldown(currentProvider, reason, cooldownDuration);

        // Find next provider in chain for informational logging
        const nextProvider = this.chain[i + 1] || 'keyword';
        const isVertexAiNext = nextProvider === 'vertexai';

        if (isRateLimit) {
          console.warn(
            `[AI Fallback] ${currentProvider} hit rate limit (HTTP 429). Switching to ${isVertexAiNext ? 'last AI fallback (Vertex AI)' : nextProvider}...`,
          );
        } else {
          console.warn(
            `[AI Fallback] ${currentProvider} error: ${reason}. Switching to ${isVertexAiNext ? 'last AI fallback (Vertex AI)' : nextProvider}...`,
          );
        }

        // Loop automatically continues to next provider in the chain
      }
    }

    // Safety fallback to keyword if loop exited
    const keywordAdapter = this.adapters.get('keyword') || new KeywordClassifierAdapter();
    const result = await keywordAdapter.classify(title, description);
    return {
      ...result,
      fallbackUsed: true,
      primaryProviderFailed: firstAttemptedProvider || 'none',
    };
  }

  public async classifyBulk(
    projects: Array<{ title: string; description: string }>,
  ): Promise<ClassificationResult[]> {
    return Promise.all(projects.map((p) => this.classify(p.title, p.description)));
  }
}
