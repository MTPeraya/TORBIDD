// =============================================================================
// app/api/ai/classify/route.ts - AI Classification & Provider Diagnostics (UC-10)
// Supports: Google AI Studio, Vertex AI, OpenRouter, and Keyword Fallback
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { classifyProject } from '@/services/ai/classifier';
import {
  getAiClassifierAdapter,
  GoogleAiStudioAdapter,
  VertexAiAdapter,
  OpenRouterAdapter,
  KeywordClassifierAdapter,
} from '@/services/ai/adapters';
import { AiClassifySchema } from '@/lib/validation';

/**
 * GET /api/ai/classify - Diagnostic endpoint reporting provider configuration status
 */
export async function GET() {
  const googleAdapter = new GoogleAiStudioAdapter();
  const vertexAdapter = new VertexAiAdapter();
  const openrouterAdapter = new OpenRouterAdapter();
  const keywordAdapter = new KeywordClassifierAdapter();
  const activeAdapter = getAiClassifierAdapter();

  return NextResponse.json({
    data: {
      activeProvider: activeAdapter.provider,
      activeModel: activeAdapter.model,
      taggingEnabled: process.env.AI_TAGGING_ENABLED !== 'false',
      providers: {
        'google-ai-studio': {
          name: googleAdapter.name,
          configured: googleAdapter.isConfigured(),
          model: googleAdapter.model,
        },
        vertexai: {
          name: vertexAdapter.name,
          configured: vertexAdapter.isConfigured(),
          model: vertexAdapter.model,
        },
        openrouter: {
          name: openrouterAdapter.name,
          configured: openrouterAdapter.isConfigured(),
          model: openrouterAdapter.model,
        },
        keyword: {
          name: keywordAdapter.name,
          configured: keywordAdapter.isConfigured(),
          model: keywordAdapter.model,
        },
      },
    },
  });
}

/**
 * POST /api/ai/classify - Classify project title & description
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = AiClassifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { title, description } = parsed.data;

    // Optional provider or key overrides from body if provided (e.g. for testing)
    const options = {
      provider: typeof body.provider === 'string' ? body.provider : undefined,
      apiKey: typeof body.apiKey === 'string' ? body.apiKey : undefined,
      model: typeof body.model === 'string' ? body.model : undefined,
    };

    const result = await classifyProject(title, description, options);
    return NextResponse.json({ data: result });
  } catch (err) {
    console.error('[POST /api/ai/classify]', err);
    return NextResponse.json({ error: 'AI classification failed' }, { status: 500 });
  }
}
