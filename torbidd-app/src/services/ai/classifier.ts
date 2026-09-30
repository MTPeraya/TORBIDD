// =============================================================================
// services/ai/classifier.ts - Project Classification Service (UC-10)
// Classifies procurement projects into software categories and determines
// whether they are software-related or non-software-related.
// SERVER ONLY — do not import in client components.
//
// Supports multi-backend adapters:
// - Google AI Studio (Gemini REST API)
// - Google Cloud Vertex AI
// - OpenRouter (Multi-model LLM API)
// - Rule-based keyword fallback
// =============================================================================

import {
  ClassificationResult,
  SOFTWARE_CATEGORIES,
  classifyByKeywords,
  getAiClassifierAdapter,
  GetAdapterOptions,
} from './adapters';

export { SOFTWARE_CATEGORIES, classifyByKeywords };
export type { ClassificationResult };

/**
 * Classifies a procurement project using the configured AI provider.
 * Falls back to keyword-based classification if AI is disabled, unconfigured, or fails.
 */
export async function classifyProject(
  title: string,
  description: string,
  options?: GetAdapterOptions,
): Promise<ClassificationResult> {
  const adapter = getAiClassifierAdapter(options);
  return adapter.classify(title, description);
}

/**
 * Bulk classify an array of projects (title + description pairs).
 * Returns results in the same order as the input array.
 */
export async function classifyProjectsBulk(
  projects: Array<{ title: string; description: string }>,
  options?: GetAdapterOptions,
): Promise<ClassificationResult[]> {
  const adapter = getAiClassifierAdapter(options);
  if (adapter.classifyBulk) {
    return adapter.classifyBulk(projects);
  }
  return Promise.all(projects.map(({ title, description }) => adapter.classify(title, description)));
}
