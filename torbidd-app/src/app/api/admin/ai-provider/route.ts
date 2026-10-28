// =============================================================================
// app/api/admin/ai-provider/route.ts
// GET / POST /api/admin/ai-provider — Manage AI Provider & Rate-Limit Fallback Switching
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';
import {
  getAiClassifierAdapter,
  switchActiveAiProvider,
  resetProviderCooldowns,
  normalizeProviderName,
  FallbackClassifierAdapter,
} from '@/services/ai/adapters';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ai-provider
 * Returns provider diagnostic status, current active provider, and fallback chain.
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const adapter = getAiClassifierAdapter();
    const isFallback = adapter instanceof FallbackClassifierAdapter;
    const diagnostics = isFallback ? adapter.getDiagnostics() : [];
    const chain = isFallback ? adapter.getFallbackChain() : [adapter.provider];

    return NextResponse.json({
      success: true,
      data: {
        activeProvider: adapter.provider,
        activeModel: adapter.model,
        isFallbackEnabled: isFallback,
        fallbackChain: chain,
        lastAiFallback: 'vertexai',
        diagnostics,
      },
    });
  } catch (err) {
    console.error('[GET /api/admin/ai-provider]', err);
    return NextResponse.json({ error: 'Failed to retrieve AI provider status' }, { status: 500 });
  }
}

/**
 * POST /api/admin/ai-provider
 * Switch active AI provider or reset rate-limit cooldowns.
 * Body: { provider?: string; resetCooldowns?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.resetCooldowns) {
      resetProviderCooldowns();
      return NextResponse.json({
        success: true,
        message: 'All AI provider rate-limit cooldowns have been reset',
      });
    }

    if (typeof body.provider === 'string') {
      const normalized = normalizeProviderName(body.provider);
      switchActiveAiProvider(normalized);

      const adapter = getAiClassifierAdapter();
      return NextResponse.json({
        success: true,
        message: `Active AI provider switched to ${normalized}`,
        data: {
          activeProvider: adapter.provider,
          activeModel: adapter.model,
        },
      });
    }

    return NextResponse.json(
      { error: 'Please specify "provider" to switch or "resetCooldowns: true"' },
      { status: 400 },
    );
  } catch (err) {
    console.error('[POST /api/admin/ai-provider]', err);
    return NextResponse.json({ error: 'Failed to update AI provider' }, { status: 500 });
  }
}
