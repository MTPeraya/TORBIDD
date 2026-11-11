// =============================================================================
// services/translation/translation-validator.ts
// Translation quality validation for Thai-to-English (TH/EN) translation
// =============================================================================

export type ValidationErrorCode =
  | 'OK'
  | 'EMPTY_TRANSLATION'
  | 'UNCHANGED_THAI'
  | 'MISSING_SOURCE'
  | 'MALFORMED'
  | 'INVALID_CHARACTERS';

export interface TranslationValidationResult {
  isValid: boolean;
  code: ValidationErrorCode;
  reason?: string;
  thaiRatio?: number;
}

export interface ValidationOptions {
  /** Maximum acceptable Thai character ratio in English translation (default: 0.2 / 20%) */
  maxThaiRatio?: number;
  /** Whether to allow identical string if source contains no Thai characters (default: true) */
  allowIdenticalIfNoThai?: boolean;
}

export class TranslationValidator {
  private static readonly THAI_REGEX = /[\u0E00-\u0E7F]/;
  private static readonly THAI_GLOBAL_REGEX = /[\u0E00-\u0E7F]/g;
  private static readonly PUNCTUATION_ONLY_REGEX = /^[\s.,\/#!$%\^&\*;:{}=\-_`~()?"'\[\]\\|<>@+]+$/;

  /**
   * Checks whether the given string contains any Thai Unicode characters.
   */
  public static containsThai(text: string | null | undefined): boolean {
    if (!text || typeof text !== 'string') return false;
    return this.THAI_REGEX.test(text);
  }

  /**
   * Calculates the proportion of Thai characters in the text (ignoring spaces).
   */
  public static getThaiRatio(text: string | null | undefined): number {
    if (!text || typeof text !== 'string') return 0;
    const clean = text.replace(/\s+/g, '');
    if (clean.length === 0) return 0;
    const thaiMatches = clean.match(this.THAI_GLOBAL_REGEX);
    return thaiMatches ? thaiMatches.length / clean.length : 0;
  }

  /**
   * Validates a translation result against its source text.
   */
  public static validate(
    sourceText: unknown,
    translatedText: unknown,
    options?: ValidationOptions,
  ): TranslationValidationResult {
    // 1. Missing or invalid source text
    if (sourceText === null || sourceText === undefined || typeof sourceText !== 'string' || sourceText.trim() === '') {
      return {
        isValid: false,
        code: 'MISSING_SOURCE',
        reason: 'Source text is missing, null, undefined, or empty',
      };
    }

    // 2. Missing, non-string, or empty translation text
    if (translatedText === null || translatedText === undefined || typeof translatedText !== 'string') {
      return {
        isValid: false,
        code: 'EMPTY_TRANSLATION',
        reason: 'Translation text is null, undefined, or not a string',
      };
    }

    const trimmedSource = sourceText.trim();
    const trimmedTranslation = translatedText.trim();

    if (trimmedTranslation === '') {
      return {
        isValid: false,
        code: 'EMPTY_TRANSLATION',
        reason: 'Translation text is empty or contains only whitespace',
      };
    }

    // 3. Malformed results check (error keywords or placeholders)
    const lowerTranslation = trimmedTranslation.toLowerCase();
    const malformedKeywords = ['undefined', 'null', '[error]', 'error', 'n/a', 'nan', '[object object]'];
    if (malformedKeywords.includes(lowerTranslation)) {
      return {
        isValid: false,
        code: 'MALFORMED',
        reason: `Translation text is a placeholder or error token: "${trimmedTranslation}"`,
      };
    }

    // Translation only contains punctuation while source had alphanumeric characters
    if (this.PUNCTUATION_ONLY_REGEX.test(trimmedTranslation) && !this.PUNCTUATION_ONLY_REGEX.test(trimmedSource)) {
      return {
        isValid: false,
        code: 'MALFORMED',
        reason: 'Translation text contains only punctuation marks',
      };
    }

    const sourceHasThai = this.containsThai(trimmedSource);
    const allowIdenticalIfNoThai = options?.allowIdenticalIfNoThai ?? true;

    // 4. Unchanged Thai text
    if (trimmedSource.toLowerCase() === trimmedTranslation.toLowerCase()) {
      if (sourceHasThai) {
        return {
          isValid: false,
          code: 'UNCHANGED_THAI',
          reason: 'Translation is identical to Thai source text without translation',
        };
      } else if (!allowIdenticalIfNoThai) {
        return {
          isValid: false,
          code: 'UNCHANGED_THAI',
          reason: 'Translation is identical to source text',
        };
      }
    }

    // 5. Excessive Thai characters in English translation
    const maxThaiRatio = options?.maxThaiRatio ?? 0.2;
    const thaiRatio = this.getThaiRatio(trimmedTranslation);

    if (sourceHasThai && thaiRatio > maxThaiRatio) {
      return {
        isValid: false,
        code: 'UNCHANGED_THAI',
        reason: `Translation contains excessive Thai characters (${(thaiRatio * 100).toFixed(1)}% > ${(maxThaiRatio * 100).toFixed(1)}%)`,
        thaiRatio,
      };
    }

    // 6. Valid translation
    return {
      isValid: true,
      code: 'OK',
      thaiRatio,
    };
  }

  /**
   * Helper to validate a batch of field translations.
   */
  public static validateBatch(
    entries: Array<{ field: string; source: unknown; translation: unknown }>,
    options?: ValidationOptions,
  ): Record<string, TranslationValidationResult> {
    const results: Record<string, TranslationValidationResult> = {};
    for (const entry of entries) {
      results[entry.field] = this.validate(entry.source, entry.translation, options);
    }
    return results;
  }
}

