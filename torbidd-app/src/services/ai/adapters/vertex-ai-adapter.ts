// =============================================================================
// services/ai/adapters/vertex-ai-adapter.ts
// Google Cloud Vertex AI Gemini Classifier Adapter (UC-10)
// =============================================================================

import { AiClassifierAdapter, ClassificationResult } from './types';
import { buildClassificationPrompt, parseAndValidateAiResponse } from './prompt';
import { classifyByKeywords } from './keyword-adapter';
import { getVertexAI, VERTEX_MODEL_FLASH } from '../vertex-ai';

export interface VertexAiAdapterOptions {
  model?: string;
}

export class VertexAiAdapter implements AiClassifierAdapter {
  public readonly name = 'VertexAiAdapter';
  public readonly provider = 'vertexai';
  public readonly model: string;

  public constructor(options: VertexAiAdapterOptions = {}) {
    this.model = options.model ?? process.env.VERTEX_AI_MODEL ?? VERTEX_MODEL_FLASH;
  }

  public isConfigured(): boolean {
    const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
    return Boolean(project && project !== 'your-gcp-project-id' && project.length > 0);
  }

  public async classify(title: string, description: string): Promise<ClassificationResult> {
    if (!this.isConfigured()) {
      return classifyByKeywords(title, description);
    }

    try {
      const vertexAI = getVertexAI();
      const generativeModel = vertexAI.getGenerativeModel({ model: this.model });

      const prompt = buildClassificationPrompt(title, description);
      const result = await generativeModel.generateContent(prompt);
      const rawText = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      return parseAndValidateAiResponse(
        rawText,
        () => classifyByKeywords(title, description),
        { provider: this.provider, model: this.model },
      );
    } catch (err) {
      console.warn(
        '[VertexAiAdapter] Classification failed — falling back to keyword classifier:',
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
