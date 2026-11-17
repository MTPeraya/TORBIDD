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
import {
  checkRateLimit,
  getClientIp,
  rateLimitHeaders,
  AI_CLASSIFY_LIMITER,
} from '@/lib/rate-limiter';

/**
 * GET /api/ai/classify - Diagnostic endpoint reporting provider configuration status
 */
export async function GET() {
  const googleAdapter = new GoogleAiStudioAdapter();
  const vertexAdapter = new VertexAiAdapter();
  const openrouterAdapter = new OpenRouterAdapter();
  const keywordAdapter = new KeywordClassifierAdapter();
  const activeAdapter = getAiClassifierAdapter();

  let fallbackChain: string[] = ['google-ai-studio', 'openrouter', 'vertexai', 'keyword'];
  let fallbackDiagnostics: unknown[] = [];

  if ('getFallbackChain' in activeAdapter && typeof activeAdapter.getFallbackChain === 'function') {
    fallbackChain = activeAdapter.getFallbackChain();
  }
  if ('getDiagnostics' in activeAdapter && typeof activeAdapter.getDiagnostics === 'function') {
    fallbackDiagnostics = activeAdapter.getDiagnostics();
  }

  return NextResponse.json({
    data: {
      activeProvider: activeAdapter.provider,
      activeModel: activeAdapter.model,
      taggingEnabled: process.env.AI_TAGGING_ENABLED !== 'false',
      fallbackChain,
      fallbackDiagnostics,
      lastAiFallback: 'vertexai',
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
  // ── ASVS req_id 2.4.1: Anti-automation control ─────────────────────────────
  const clientIp = getClientIp(req);
  const rl = checkRateLimit('ai-classify', clientIp, AI_CLASSIFY_LIMITER);
  const rlHeaders = rateLimitHeaders(rl, AI_CLASSIFY_LIMITER.max);

  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'Too many classification requests. Please wait before submitting again.',
        retryAfter: rl.retryAfter,
      },
      { status: 429, headers: rlHeaders },
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  try {
    const body = await req.json();
    const parsed = AiClassifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400, headers: rlHeaders },
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
    return NextResponse.json({ data: result }, { headers: rlHeaders });
  } catch (err) {
    console.error('[POST /api/ai/classify]', err);
    return NextResponse.json({ error: 'AI classification failed' }, { status: 500, headers: rlHeaders });
  }
}
