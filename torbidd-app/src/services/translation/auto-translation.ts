// =============================================================================
// services/translation/auto-translation.ts
// Automatic Translation Service for Thai to English (TH/EN) translation
// Batches requests, manages cache, validates quality, and preserves Thai source.
// =============================================================================

import { TranslationServiceClient } from '@google-cloud/translate';
import { TranslationCache, defaultTranslationCache } from './translation-cache';
import {
  TranslationValidator,
  TranslationValidationResult,
  ValidationOptions,
} from './translation-validator';

export class TranslationError extends Error {
  public code?: string;
  public status?: number;

  constructor(message: string, code?: string, status = 500) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
    this.status = status;
  }
}

export interface TranslatableProject {
  id?: string | number;
  externalId?: string | number;
  externalProjectId?: string;
  contentHash?: string;
  title?: string | { th?: string; en?: string };
  department?: string | { th?: string; en?: string };
  projectName?: string;
  agencyName?: string;
  description?: string | { th?: string; en?: string };
  summary?: string | { th?: string; en?: string };
  [key: string]: unknown;
}

export interface ProjectTranslationResult {
  updatedFields: {
    title?: { th: string; en: string };
    department?: { th: string; en: string };
    description?: { th: string; en: string };
    summary?: { th: string; en: string };
    projectNameEn?: string;
    agencyNameEn?: string;
    [key: string]: unknown;
  };
  translations: Record<string, string>;
  stats: {
    totalFields: number;
    translatedCount: number;
    cachedCount: number;
    skippedCount: number;
    apiCalls: number;
  };
  validationResults: Record<string, TranslationValidationResult>;
}

export interface AutoTranslationServiceOptions {
  client?: TranslationServiceClient;
  cache?: TranslationCache;
  projectId?: string;
  location?: string;
  validateQuality?: boolean;
  validationOptions?: ValidationOptions;
}

export class AutoTranslationService {
  private client: TranslationServiceClient;
  private cache: TranslationCache;
  private projectId: string;
  private location: string;
  private validateQuality: boolean;
  private validationOptions?: ValidationOptions;

  constructor(options?: AutoTranslationServiceOptions) {
    this.client = options?.client ?? new TranslationServiceClient();
    this.cache = options?.cache ?? defaultTranslationCache;
    this.projectId =
      options?.projectId ??
      process.env.GOOGLE_CLOUD_PROJECT ??
      process.env.GCP_PROJECT ??
      'torbidd-project';
    this.location = options?.location ?? 'global';
    this.validateQuality = options?.validateQuality ?? true;
    this.validationOptions = options?.validationOptions;
  }

  /**
   * Translates a batch of texts using Google Cloud Translation API.
   * Sends all texts in a single batch request.
   */
  public async translateBatch(
    texts: string[],
    options?: {
      sourceLanguage?: string;
      targetLanguage?: string;
    },
  ): Promise<string[]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    const sourceLanguageCode = options?.sourceLanguage ?? 'th';
    const targetLanguageCode = options?.targetLanguage ?? 'en';
    const parent = `projects/${this.projectId}/locations/${this.location}`;

    try {
      const apiResponse = await this.client.translateText({
        parent,
        contents: texts,
        mimeType: 'text/plain',
        sourceLanguageCode,
        targetLanguageCode,
      });

      const response = Array.isArray(apiResponse) ? apiResponse[0] : apiResponse;

      if (!response || !response.translations || !Array.isArray(response.translations)) {
        throw new TranslationError(
          'Malformed response from Google Cloud Translation API: missing translations array',
          'MALFORMED_RESPONSE',
          502,
        );
      }

      if (response.translations.length === 0 && texts.length > 0) {
        throw new TranslationError(
          'Empty translations returned from Google Cloud Translation API',
          'EMPTY_RESPONSE',
          502,
        );
      }

      return response.translations.map((t: { translatedText?: string | null }) => {
        if (!t || typeof t.translatedText !== 'string') {
          throw new TranslationError(
            'Malformed translation entry in API response',
            'MALFORMED_RESPONSE',
            502,
          );
        }
        return t.translatedText;
      });
    } catch (err) {
      if (err instanceof TranslationError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new TranslationError(
        `Google Cloud Translation API failed: ${msg}`,
        'API_FAILURE',
        502,
      );
    }
  }

  /**
   * Translates a single text string with cache support and quality validation.
   */
  public async translateText(
    text: string,
    options?: {
      sourceLanguage?: string;
      targetLanguage?: string;
      contentHash?: string;
      field?: string;
      bypassCache?: boolean;
    },
  ): Promise<{
    translatedText: string;
    cached: boolean;
    validation?: TranslationValidationResult;
  }> {
    if (text === null || text === undefined || typeof text !== 'string' || text.trim() === '') {
      throw new TranslationError('Text to translate is missing or empty', 'INVALID_INPUT', 400);
    }

    const contentHash = options?.contentHash ?? TranslationCache.computeContentHash(text);
    const field = options?.field ?? 'default';

    if (!options?.bypassCache) {
      const cached = this.cache.get(contentHash, field);
      if (cached !== null) {
        return {
          translatedText: cached,
          cached: true,
          validation: this.validateQuality
            ? TranslationValidator.validate(text, cached, this.validationOptions)
            : undefined,
        };
      }
    }

    const [translated] = await this.translateBatch([text], {
      sourceLanguage: options?.sourceLanguage,
      targetLanguage: options?.targetLanguage,
    });

    let validation: TranslationValidationResult | undefined;
    if (this.validateQuality) {
      validation = TranslationValidator.validate(text, translated, this.validationOptions);
      if (!validation.isValid) {
        throw new TranslationError(
          `Translation quality validation failed: ${validation.reason ?? validation.code}`,
          validation.code,
          422,
        );
      }
    }

    this.cache.set(contentHash, field, translated);

    return {
      translatedText: translated,
      cached: false,
      validation,
    };
  }

  /**
   * Translates a project entity by extracting translatable fields (title, department,
   * description, summary, etc.), batching uncached fields, and returning updated fields
   * while keeping original Thai text completely unchanged.
   */
  public async translateProject(
    project: TranslatableProject,
    options?: {
      sourceLanguage?: string;
      targetLanguage?: string;
      bypassCache?: boolean;
      validateQuality?: boolean;
    },
  ): Promise<ProjectTranslationResult> {
    if (!project || typeof project !== 'object') {
      throw new TranslationError('Project object is missing or invalid', 'INVALID_INPUT', 400);
    }

    // Determine deterministic content hash
    const contentHash =
      project.contentHash ||
      TranslationCache.computeContentHash({
        id: project.id ?? project.externalId ?? project.externalProjectId,
        title: project.title ?? project.projectName,
        department: project.department ?? project.agencyName,
        description: project.description,
        summary: project.summary,
      });

    interface FieldCandidate {
      fieldName: 'title' | 'department' | 'description' | 'summary';
      thSource: string;
      existingEn: string;
      isProjectNameAlias?: boolean;
      isAgencyNameAlias?: boolean;
    }

    const candidates: FieldCandidate[] = [];

    // 1. Title / Project Name
    let titleTh = '';
    let titleEn = '';
    let isProjectName = false;
    if (typeof project.title === 'object' && project.title !== null) {
      titleTh = project.title.th ?? '';
      titleEn = project.title.en ?? '';
    } else if (typeof project.title === 'string') {
      titleTh = project.title;
    } else if (typeof project.projectName === 'string') {
      titleTh = project.projectName;
      isProjectName = true;
    }
    candidates.push({
      fieldName: 'title',
      thSource: titleTh.trim(),
      existingEn: titleEn.trim(),
      isProjectNameAlias: isProjectName,
    });

    // 2. Department / Agency Name
    let deptTh = '';
    let deptEn = '';
    let isAgencyName = false;
    if (typeof project.department === 'object' && project.department !== null) {
      deptTh = project.department.th ?? '';
      deptEn = project.department.en ?? '';
    } else if (typeof project.department === 'string') {
      deptTh = project.department;
    } else if (typeof project.agencyName === 'string') {
      deptTh = project.agencyName;
      isAgencyName = true;
    }
    candidates.push({
      fieldName: 'department',
      thSource: deptTh.trim(),
      existingEn: deptEn.trim(),
      isAgencyNameAlias: isAgencyName,
    });

    // 3. Description (optional)
    if (project.description !== undefined) {
      let descTh = '';
      let descEn = '';
      if (typeof project.description === 'object' && project.description !== null) {
        descTh = project.description.th ?? '';
        descEn = project.description.en ?? '';
      } else if (typeof project.description === 'string') {
        descTh = project.description;
      }
      candidates.push({
        fieldName: 'description',
        thSource: descTh.trim(),
        existingEn: descEn.trim(),
      });
    }

    // 4. Summary (optional)
    if (project.summary !== undefined) {
      let sumTh = '';
      let sumEn = '';
      if (typeof project.summary === 'object' && project.summary !== null) {
        sumTh = project.summary.th ?? '';
        sumEn = project.summary.en ?? '';
      } else if (typeof project.summary === 'string') {
        sumTh = project.summary;
      }
      candidates.push({
        fieldName: 'summary',
        thSource: sumTh.trim(),
        existingEn: sumEn.trim(),
      });
    }

    const translations: Record<string, string> = {};
    const updatedFields: ProjectTranslationResult['updatedFields'] = {};
    const validationResults: Record<string, TranslationValidationResult> = {};

    let totalFields = 0;
    let translatedCount = 0;
    let cachedCount = 0;
    let skippedCount = 0;
    let apiCalls = 0;

    const fieldsNeedingTranslation: Array<{ candidate: FieldCandidate; index: number }> = [];

    for (const candidate of candidates) {
      const { fieldName, thSource, existingEn, isProjectNameAlias, isAgencyNameAlias } = candidate;

      // Missing or empty Thai text -> skip without translation API call
      if (!thSource) {
        skippedCount++;
        continue;
      }

      totalFields++;

      // Already translated: English value is present and non-empty
      if (existingEn) {
        skippedCount++;
        translations[fieldName] = existingEn;
        updatedFields[fieldName] = { th: thSource, en: existingEn };
        if (isProjectNameAlias) updatedFields.projectNameEn = existingEn;
        if (isAgencyNameAlias) updatedFields.agencyNameEn = existingEn;
        continue;
      }

      // Check cache for this contentHash and field
      if (!options?.bypassCache) {
        const cachedTranslation = this.cache.get(contentHash, fieldName);
        if (cachedTranslation !== null) {
          cachedCount++;
          translations[fieldName] = cachedTranslation;
          updatedFields[fieldName] = { th: thSource, en: cachedTranslation };
          if (isProjectNameAlias) updatedFields.projectNameEn = cachedTranslation;
          if (isAgencyNameAlias) updatedFields.agencyNameEn = cachedTranslation;

          if (this.validateQuality) {
            validationResults[fieldName] = TranslationValidator.validate(
              thSource,
              cachedTranslation,
              this.validationOptions,
            );
          }
          continue;
        }
      }

      // Needs translation via Google Cloud API
      fieldsNeedingTranslation.push({ candidate, index: fieldsNeedingTranslation.length });
    }

    // Batch translate all uncached fields in a single API call
    if (fieldsNeedingTranslation.length > 0) {
      const batchTexts = fieldsNeedingTranslation.map((f) => f.candidate.thSource);
      apiCalls++;
      const translatedBatch = await this.translateBatch(batchTexts, {
        sourceLanguage: options?.sourceLanguage,
        targetLanguage: options?.targetLanguage,
      });

      for (let i = 0; i < fieldsNeedingTranslation.length; i++) {
        const { candidate } = fieldsNeedingTranslation[i];
        const { fieldName, thSource, isProjectNameAlias, isAgencyNameAlias } = candidate;
        const translated = translatedBatch[i];

        let validation: TranslationValidationResult = { isValid: true, code: 'OK' };
        if (this.validateQuality) {
          validation = TranslationValidator.validate(
            thSource,
            translated,
            this.validationOptions,
          );
          validationResults[fieldName] = validation;
          if (!validation.isValid) {
            throw new TranslationError(
              `Translation validation failed for ${fieldName}: ${validation.reason ?? validation.code}`,
              validation.code,
              422,
            );
          }
        }

        // Store translation in cache
        this.cache.set(contentHash, fieldName, translated);

        translations[fieldName] = translated;
        // The original Thai content remains unchanged in the update structure
        updatedFields[fieldName] = { th: thSource, en: translated };
        if (isProjectNameAlias) updatedFields.projectNameEn = translated;
        if (isAgencyNameAlias) updatedFields.agencyNameEn = translated;
        translatedCount++;
      }
    }

    return {
      updatedFields,
      translations,
      stats: {
        totalFields,
        translatedCount,
        cachedCount,
        skippedCount,
        apiCalls,
      },
      validationResults,
    };
  }

  /**
   * Helper to retrieve the current cache instance.
   */
  public getCache(): TranslationCache {
    return this.cache;
  }
}

