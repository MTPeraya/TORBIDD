// =============================================================================
// app/api/admin/translate/route.ts
// Administrative API endpoint for translation service management, batch translation,
// quality validation, and cache inspection.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthSessionFromRequest, isAdminUser } from '@/lib/auth';
import {
  AutoTranslationService,
  TranslationError,
  TranslatableProject,
} from '@/services/translation/auto-translation';
import { defaultTranslationCache } from '@/services/translation/translation-cache';
import { TranslationValidator } from '@/services/translation/translation-validator';

const AdminTranslateSchema = z.object({
  action: z.enum(['translate', 'validate', 'clear-cache']).optional().default('translate'),
  text: z.string().optional(),
  texts: z.array(z.string()).optional(),
  fields: z.record(z.string(), z.string()).optional(),
  project: z
    .object({
      id: z.union([z.string(), z.number()]).optional(),
      externalProjectId: z.string().optional(),
      contentHash: z.string().optional(),
      title: z
        .union([
          z.string(),
          z.object({ th: z.string().optional(), en: z.string().optional() }),
        ])
        .optional(),
      department: z
        .union([
          z.string(),
          z.object({ th: z.string().optional(), en: z.string().optional() }),
        ])
        .optional(),
      projectName: z.string().optional(),
      agencyName: z.string().optional(),
      description: z
        .union([
          z.string(),
          z.object({ th: z.string().optional(), en: z.string().optional() }),
        ])
        .optional(),
      summary: z
        .union([
          z.string(),
          z.object({ th: z.string().optional(), en: z.string().optional() }),
        ])
        .optional(),
    })
    .optional(),
  sourceLanguage: z.string().optional().default('th'),
  targetLanguage: z.string().optional().default('en'),
  sourceText: z.string().optional(),
  translatedText: z.string().optional(),
  bypassCache: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Admin Authentication Guard
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 },
      );
    }

    // 2. Body parsing
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body: Malformed JSON' },
        { status: 400 },
      );
    }

    const parseResult = AdminTranslateSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request payload',
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const {
      action,
      text,
      texts,
      fields,
      project,
      sourceLanguage,
      targetLanguage,
      sourceText,
      translatedText,
      bypassCache,
    } = parseResult.data;

    // 3. Supported Language Check
    const normalizedSrc = sourceLanguage.trim().toLowerCase();
    const normalizedTgt = targetLanguage.trim().toLowerCase();
    if (normalizedSrc !== 'th' || normalizedTgt !== 'en') {
      return NextResponse.json(
        {
          error: `Unsupported language pair '${sourceLanguage}' -> '${targetLanguage}'. Only 'th' to 'en' is supported.`,
          code: 'UNSUPPORTED_LANGUAGE',
        },
        { status: 400 },
      );
    }

    // 4. Action: clear-cache
    if (action === 'clear-cache') {
      defaultTranslationCache.clear();
      return NextResponse.json({
        success: true,
        data: { message: 'Translation cache cleared successfully', cacheSize: 0 },
      });
    }

    // 5. Action: validate
    if (action === 'validate') {
      if (sourceText === undefined || translatedText === undefined) {
        return NextResponse.json(
          {
            error: 'Validation action requires both sourceText and translatedText',
            code: 'MISSING_VALIDATION_FIELDS',
          },
          { status: 400 },
        );
      }
      const validation = TranslationValidator.validate(sourceText, translatedText);
      return NextResponse.json({
        success: true,
        data: { validation },
      });
    }

    // 6. Action: translate
    const translationService = new AutoTranslationService({
      cache: defaultTranslationCache,
    });

    if (project) {
      const result = await translationService.translateProject(
        project as TranslatableProject,
        {
          sourceLanguage: normalizedSrc,
          targetLanguage: normalizedTgt,
          bypassCache,
        },
      );
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    if (fields) {
      const projectPayload: TranslatableProject = {
        title: fields.title,
        department: fields.department,
        description: fields.description,
        summary: fields.summary,
      };
      const result = await translationService.translateProject(projectPayload, {
        sourceLanguage: normalizedSrc,
        targetLanguage: normalizedTgt,
        bypassCache,
      });
      return NextResponse.json({
        success: true,
        data: {
          translations: result.translations,
          updatedFields: result.updatedFields,
          stats: result.stats,
          validationResults: result.validationResults,
        },
      });
    }

    if (texts && texts.length > 0) {
      const translatedList = await translationService.translateBatch(texts, {
        sourceLanguage: normalizedSrc,
        targetLanguage: normalizedTgt,
      });
      return NextResponse.json({
        success: true,
        data: {
          translations: translatedList,
          count: translatedList.length,
        },
      });
    }

    if (text !== undefined && text.trim() !== '') {
      const result = await translationService.translateText(text, {
        sourceLanguage: normalizedSrc,
        targetLanguage: normalizedTgt,
        bypassCache,
      });
      return NextResponse.json({
        success: true,
        data: result,
      });
    }

    // No translatable content provided
    return NextResponse.json(
      {
        error: 'Missing required translatable content: provide text, texts, fields, or project',
        code: 'MISSING_TRANSLATABLE_CONTENT',
      },
      { status: 400 },
    );
  } catch (err) {
    if (err instanceof TranslationError) {
      return NextResponse.json(
        {
          error: err.message,
          code: err.code ?? 'TRANSLATION_ERROR',
        },
        { status: err.status ?? 500 },
      );
    }

    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return NextResponse.json(
      {
        error: 'Internal translation endpoint error',
        message,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const authUser = getAuthSessionFromRequest(req);
    if (!authUser || !isAdminUser(authUser)) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        cacheSize: defaultTranslationCache.size(),
        supportedLanguages: {
          source: 'th',
          target: 'en',
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to retrieve translation status', details: String(err) },
      { status: 500 },
    );
  }
}

