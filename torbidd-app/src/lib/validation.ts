// =============================================================================
// lib/validation.ts - Zod Schemas for API Input Validation
// SEC-01 / ASVS V1.1.1: Input Canonicalization & Output Encoding Architecture
// =============================================================================

import { z } from 'zod';
import { canonicalString, canonicalizeString } from './canonicalize';
import { validateSafeUrl } from './ssrf';

export { canonicalString, canonicalizeString, validateSafeUrl };

// UC-10: Expanded software categories
export const VALID_CATEGORIES = [
  'Website',
  'Mobile App',
  'AI',
  'Database',
  'ERP',
  'Cloud',
  'Data Analytics',
  'Information System',
] as const;

/** Pattern to detect NoSQL / MongoDB operator injection in user input strings (ASVS V5.3.4 & V1.1.1) */
const NOSQL_INJECTION_PATTERN = /([{"']|^)\$[a-zA-Z]+/;

export const SafeSearchQuerySchema = canonicalString(
  z.string()
    .max(200)
    .refine((val) => !NOSQL_INJECTION_PATTERN.test(val), {
      message: 'Invalid search query: operator injection pattern detected',
    }),
);

export const ProjectFiltersSchema = z
  .object({
    search: SafeSearchQuerySchema.optional(),
    department: canonicalString(z.string().max(200)).optional(),
    agency: canonicalString(z.string().max(200)).optional(),
    agencies: z.union([canonicalString(z.string()), z.array(canonicalString(z.string()))]).optional(),
    category: z.enum(VALID_CATEGORIES).optional(),
    categories: z.union([canonicalString(z.string()), z.array(canonicalString(z.string()))]).optional(),
    isSoftwareRelated: z
      .preprocess((v) => {
        if (v === 'true' || v === true) return true;
        if (v === 'false' || v === false) return false;
        return undefined;
      }, z.boolean().optional()), // UC-10
    classificationReviewStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED']).optional(), // UC-10
    budget: z.enum(['under5m', '5to10', '10to20', 'above20m']).optional(),
    minBudget: z.coerce.number().min(0).optional(),
    maxBudget: z.coerce.number().min(0).optional(),
    deadline: z.enum(['within7', 'within30', 'moreThan30']).optional(),
    hideClosed: z
      .preprocess((v) => {
        if (v === 'true' || v === true) return true;
        if (v === 'false' || v === false) return false;
        return undefined;
      }, z.boolean().optional()),
    sortBy: z
      .enum([
        'publishDate_desc',
        'publishDate_asc',
        'budget_desc',
        'budget_asc',
        'deadline_asc',
        'deadline_desc',
        'newest',
        'oldest',
      ])
      .optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z
      .preprocess((v) => {
        if (v === 'all' || v === 'ALL') return 2000;
        return v;
      }, z.coerce.number().int().min(1).max(2000).optional()),
    all: z.union([z.string(), z.boolean()]).optional(),
  })
  .refine(
    (data) => {
      if (data.minBudget !== undefined && data.maxBudget !== undefined) {
        return data.minBudget <= data.maxBudget;
      }
      return true;
    },
    {
      message: 'Minimum budget cannot exceed maximum budget',
      path: ['minBudget'],
    },
  );

// ─── Procurement Filters (GET /api/procurements) ───────────────────────────

export const ProcurementFiltersSchema = z
  .object({
    search: SafeSearchQuerySchema.optional(),
    department: canonicalString(z.string().max(200)).optional(),
    agency: canonicalString(z.string().max(200)).optional(),
    agencies: z.union([canonicalString(z.string()), z.array(canonicalString(z.string()))]).optional(),
    category: z.enum(VALID_CATEGORIES).optional(),
    categories: z.union([canonicalString(z.string()), z.array(canonicalString(z.string()))]).optional(),
    isSoftwareRelated: z
      .preprocess((v) => {
        if (v === 'true' || v === true) return true;
        if (v === 'false' || v === false) return false;
        return undefined;
      }, z.boolean().optional()), // UC-10
    classificationReviewStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED']).optional(), // UC-10
    budget: z.enum(['under5m', '5to10', '10to20', 'above20m']).optional(),
    minBudget: z.coerce.number().min(0).optional(),
    maxBudget: z.coerce.number().min(0).optional(),
    deadline: z.enum(['within7', 'within30', 'moreThan30']).optional(),
    sortBy: z
      .enum([
        'publishDate_desc',
        'publishDate_asc',
        'budget_desc',
        'budget_asc',
        'deadline_asc',
        'deadline_desc',
        'newest',
        'oldest',
      ])
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(2000).default(12),
  })
  .refine(
    (data) => {
      if (data.minBudget !== undefined && data.maxBudget !== undefined) {
        return data.minBudget <= data.maxBudget;
      }
      return true;
    },
    {
      message: 'Minimum budget cannot exceed maximum budget',
      path: ['minBudget'],
    },
  );

// ─── Historical Filters (GET /api/historical) ───────────────────────────────

export const HistoricalFiltersSchema = z.object({
  category: z
    .enum(['Website', 'Mobile App', 'AI', 'Database', 'ERP', 'Cloud', 'Data Analytics', 'Information System'])
    .optional(),
  department: canonicalString(z.string().max(200)).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  search: SafeSearchQuerySchema.optional(),
  stats: z.enum(['true', 'false']).optional(),
  agencies: z.enum(['true', 'false']).optional(),
});

// ─── Bookmark (POST /api/bookmarks) ─────────────────────────────────────────

export const BookmarkCreateSchema = z
  .object({
    projectId: canonicalString(z.string().length(24)), // MongoDB ObjectId hex
  })
  .strict();

// ─── Settings (PUT /api/settings) ───────────────────────────────────────────

export const SettingsUpdateSchema = z
  .object({
    inAppNotif: z.boolean().optional(),
    emailNotif: z.boolean().optional(),
    dailyDigest: z.boolean().optional(),
    closingAlert: z.boolean().optional(),
    newProjectAlert: z.boolean().optional(),
    newOpportunity: z.boolean().optional(),
    savedUpdate: z.boolean().optional(),
    deadlineReminder: z.boolean().optional(),
    keywords: z.array(canonicalString(z.string().max(100))).max(30).optional(),
    interestTags: z.array(canonicalString(z.string().max(50))).max(20).optional(),
    agencies: z.array(canonicalString(z.string().max(150))).max(50).optional(),
    budgetMin: z.number().min(0).nullable().optional(),
    budgetMax: z.number().min(0).nullable().optional(),
    language: z.enum(['th', 'en']).optional(),
    email: canonicalString(z.string().email()).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.budgetMin != null && data.budgetMax != null) {
        return data.budgetMax >= data.budgetMin;
      }
      return true;
    },
    { message: 'budgetMax must be >= budgetMin', path: ['budgetMax'] },
  );

// ─── Notification Preferences (PUT /api/notifications/preferences) ──────────

export const NotificationPreferencesSchema = z
  .object({
    inAppNotif: z.boolean().optional(),
    newOpportunity: z.boolean().optional(),
    savedUpdate: z.boolean().optional(),
    deadlineReminder: z.boolean().optional(),
    emailNotif: z.boolean().optional(),
    dailyDigest: z.boolean().optional(),
    keywords: z.array(canonicalString(z.string().max(100))).max(30).optional(),
    interestTags: z.array(canonicalString(z.string().max(50))).max(20).optional(),
    agencies: z.array(canonicalString(z.string().max(150))).max(50).optional(),
    budgetMin: z.number().min(0).nullable().optional(),
    budgetMax: z.number().min(0).nullable().optional(),
    language: z.enum(['th', 'en']).optional(),
    email: canonicalString(z.string().email()).nullable().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.budgetMin != null && data.budgetMax != null) {
        return data.budgetMax >= data.budgetMin;
      }
      return true;
    },
    { message: 'budgetMax must be >= budgetMin', path: ['budgetMax'] },
  );

// ─── AI Extract (POST /api/ai/extract) ──────────────────────────────────────

export const AiExtractSchema = z
  .object({
    documentUrl: canonicalString(z.string().url()).optional(),
    // 25 MB decoded, rounded up for base64's 4:3 expansion.
    documentBase64: z.string().max(34_952_536).optional(),
  })
  .refine((d) => d.documentUrl || d.documentBase64, {
    message: 'Either documentUrl or documentBase64 must be provided',
  })
  .superRefine((d, ctx) => {
    if (d.documentUrl) {
      const check = validateSafeUrl(d.documentUrl);
      if (!check.valid) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: check.reason || 'Document URL fails SSRF security check',
          path: ['documentUrl'],
        });
      }
      try {
        if (!new URL(d.documentUrl).pathname.toLowerCase().endsWith('.pdf')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Document URL must identify a .pdf file',
            path: ['documentUrl'],
          });
        }
      } catch {
        // The URL validator reports malformed URLs.
      }
    }
  });

// ─── AI Classify (POST /api/ai/classify) ────────────────────────────────────

export const AiClassifySchema = z
  .object({
    title: canonicalString(z.string().min(1).max(500)),
    description: canonicalString(z.string().min(1).max(5000)),
    provider: z.string().max(50).optional(),
    apiKey: z.string().max(200).optional(),
    model: z.string().max(100).optional(),
  })
  .strict();

// ─── Ingestion: Discover (POST /api/ingestion/discover) ─────────────────────

export const IngestionDiscoverSchema = z.object({
  keyword: canonicalString(z.string().max(200)).default('ซอฟต์แวร์'),
  fiscalYear: z.coerce.number().int().min(2500).max(2600).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// ─── Ingestion: Project ID (11 digits e-GP identifier) ──────────────────────

export const ProjectIdParamSchema = z.object({
  projectId: canonicalString(z.string().trim().regex(/^\d{11}$/, 'Project ID must contain exactly 11 numeric digits')),
});

// ─── Project Create & Update (Admin CRUD) ───────────────────────────────────

export const BilingualStringSchema = z
  .object({
    th: canonicalString(z.string().min(1).max(1000)),
    en: canonicalString(z.string().max(1000)).optional(),
  })
  .transform((val) => ({
    th: val.th,
    en: val.en && val.en.trim().length > 0 ? val.en.trim() : val.th,
  }));

export const BilingualArraySchema = z
  .object({
    th: z.array(canonicalString(z.string())).min(1),
    en: z.array(canonicalString(z.string())).optional(),
  })
  .transform((val) => ({
    th: val.th,
    en: val.en && val.en.length > 0 ? val.en : val.th,
  }));

export const ProjectCreateSchema = z.object({
  externalId: z.coerce.number().int().positive().optional(),
  title: BilingualStringSchema,
  department: BilingualStringSchema,
  budget: z.coerce.number().min(0),
  fiscalYear: z.coerce.number().int().min(2500).max(2600).optional(),
  publishDate: canonicalString(z.string().min(1)),
  deadline: canonicalString(z.string().min(1)),
  category: z.enum([
    'Website',
    'Mobile App',
    'AI',
    'Database',
    'ERP',
    'Cloud',
    'Data Analytics',
    'Information System',
  ]),
  procurementType: canonicalString(z.string().min(1).max(200)),
  description: BilingualStringSchema,
  scope: BilingualArraySchema,
  qualifications: BilingualArraySchema,
  historicalAvg: z.coerce.number().min(0).optional(),
  sourceDocument: canonicalString(z.string().optional().default('')),
  sourceUrl: canonicalString(z.string().optional()),
  documentUrl: canonicalString(z.string().optional()),
  aiConfidence: z.enum(['High', 'Medium', 'Low']).optional().default('High'),
  isSoftwareRelated: z.boolean().optional().default(true), // UC-10
  classificationReviewStatus: z // UC-10
    .enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED'])
    .optional()
    .default('PENDING_REVIEW'),
});

export const ProjectUpdateSchema = ProjectCreateSchema.partial();

/**
 * ASVS req_id 15.3.3: Strict schema for Admin project updates preventing mass assignment.
 * Blocks insertion or mutation of unauthorized object fields (e.g. role, admin flags).
 */
export const AdminProjectUpdateSchema = z
  .object({
    projectName: canonicalString(z.string().min(1).max(500)).optional(),
    agencyName: canonicalString(z.string().min(1).max(500)).optional(),
    budget: z.coerce.number().min(0).optional(),
    fiscalYear: z.coerce.number().int().min(2500).max(2600).optional(),
    procurementType: canonicalString(z.string().max(200)).optional(),
    is_software: z.boolean().optional(),
    software_category: z.enum(VALID_CATEGORIES).optional(),
    classification_reason: canonicalString(z.string().max(1000)).optional(),
    admin_reviewed: z.boolean().optional(),
    review_status: z.enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED']).optional(),
  })
  .strict();
