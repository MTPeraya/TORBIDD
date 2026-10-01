// =============================================================================
// services/ai/adapters/types.ts
// Provider Adapter interfaces & types for multi-backend AI Classification (UC-10)
// =============================================================================

import { ProjectCategory } from '@/types/project';

export type AiProvider = 'google-ai-studio' | 'vertexai' | 'openrouter' | 'keyword';

export interface ClassificationResult {
  category: ProjectCategory;
  isSoftwareRelated: boolean;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
  provider?: string;
  model?: string;
}

export interface AiClassifierAdapter {
  readonly name: string;
  readonly provider: string;
  readonly model: string;

  /**
   * Check whether this adapter has the required credentials and configuration.
   */
  isConfigured(): boolean;

  /**
   * Classify a single project's title and description.
   * If an error occurs or the adapter is not configured, it must safely fall back
   * to rule-based keyword classification without throwing.
   */
  classify(title: string, description: string): Promise<ClassificationResult>;

  /**
   * Optional bulk classification implementation.
   */
  classifyBulk?(
    projects: Array<{ title: string; description: string }>,
  ): Promise<ClassificationResult[]>;
}
