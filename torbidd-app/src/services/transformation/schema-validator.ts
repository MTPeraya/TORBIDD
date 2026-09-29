// =============================================================================
// services/transformation/schema-validator.ts
// Schema Validation using Zod to reject or flag malformed procurement payloads
// =============================================================================

import { z } from 'zod';
import { NormalizedProcurementProject, TransformationIssue, TransformationStatus } from './types';

export const NormalizedProcurementSchema = z.object({
  externalProjectId: z
    .string()
    .min(1, 'Project ID is required')
    .max(50, 'Project ID exceeds maximum length'),
  projectName: z
    .string()
    .min(2, 'Project title must contain at least 2 characters')
    .max(500, 'Project title exceeds maximum length'),
  agencyName: z
    .string()
    .min(2, 'Agency name must contain at least 2 characters')
    .max(300, 'Agency name exceeds maximum length'),
  fiscalYear: z
    .number()
    .int('Fiscal year must be an integer')
    .min(2000, 'Fiscal year must be >= 2000')
    .max(2600, 'Fiscal year must be <= 2600'),
  budget: z
    .number()
    .min(0, 'Budget must not be negative'),
  publishDate: z
    .string()
    .datetime({ message: 'Publish date must be a valid ISO-8601 UTC string' }),
  procurementType: z
    .string()
    .default('e-Bidding'),
  source: z
    .string()
    .default('CENTRAL_API'),
  sourceUrl: z
    .string()
    .url('Source URL must be a valid web URL')
    .or(z.literal('')),
  documentLinks: z
    .array(z.string())
    .default([]),
  contentHash: z
    .string()
    .length(64, 'Content hash must be a 64-character SHA-256 hex string'),
  revision: z
    .number()
    .int()
    .min(1),
  transformedAt: z
    .string()
    .datetime(),
});

export interface ValidationEvaluation {
  status: TransformationStatus;
  errors: TransformationIssue[];
  flags: string[];
}

/**
 * Evaluates a normalized project against validation rules.
 * Determines if the payload is VALID, FLAGGED (warning but acceptable), or REJECTED (critical malformation).
 */
export function validateNormalizedProject(
  payload: Partial<NormalizedProcurementProject>,
): ValidationEvaluation {
  const errors: TransformationIssue[] = [];
  const flags: string[] = [];

  const parseResult = NormalizedProcurementSchema.safeParse(payload);

  if (!parseResult.success) {
    for (const issue of parseResult.error.issues) {
      const field = issue.path.join('.');
      errors.push({
        field,
        message: issue.message,
        rawValue: (payload as Record<string, unknown>)[field],
      });
    }

    return {
      status: 'REJECTED',
      errors,
      flags,
    };
  }

  const validData = parseResult.data;

  // ─── Business Rule Flagging (Warnings for human review) ─────────────────────
  // 1. National e-GP Project ID format warning (standard is 11 digits)
  if (!/^\d{11}$/.test(validData.externalProjectId)) {
    flags.push(`Non-standard project ID length: '${validData.externalProjectId}' (expected 11 digits)`);
  }

  // 2. Suspicious budget flags
  if (validData.budget === 0) {
    flags.push('Budget is 0 THB (unspecified or not disclosed)');
  } else if (validData.budget > 100_000_000_000) {
    flags.push(`Unusually high budget: ฿${validData.budget.toLocaleString()} exceeds 100 Billion THB`);
  }

  // 3. Publish date anomaly (e.g. far in the past or far in the future)
  const pubYear = new Date(validData.publishDate).getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  if (pubYear < currentYear - 5 || pubYear > currentYear + 2) {
    flags.push(`Publish date year ${pubYear} is outside expected range (${currentYear - 5} - ${currentYear + 2})`);
  }

  return {
    status: flags.length > 0 ? 'FLAGGED' : 'VALID',
    errors: [],
    flags,
  };
}
