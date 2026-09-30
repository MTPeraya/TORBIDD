// =============================================================================
// lib/validation.ts - Zod Schemas for API Input Validation
// =============================================================================

import { z } from 'zod';

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

export const ProjectFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  agency: z.string().max(200).optional(),
  agencies: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  categories: z.union([z.string(), z.array(z.string())]).optional(),
  isSoftwareRelated: z.enum(['true', 'false']).optional(), // UC-10
  classificationReviewStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED']).optional(), // UC-10
  budget: z.enum(['under5m', '5to10', '10to20', 'above20m']).optional(),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  deadline: z.enum(['within7', 'within30', 'moreThan30']).optional(),
  sortBy: z
    .enum(['publishDate_desc', 'publishDate_asc', 'budget_desc', 'budget_asc', 'newest', 'oldest'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).refine(
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

export const ProcurementFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  agency: z.string().max(200).optional(),
  agencies: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.enum(VALID_CATEGORIES).optional(),
  categories: z.union([z.string(), z.array(z.string())]).optional(),
  isSoftwareRelated: z.enum(['true', 'false']).optional(),                    // UC-10
  classificationReviewStatus: z.enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED']).optional(), // UC-10
  budget: z.enum(['under5m', '5to10', '10to20', 'above20m']).optional(),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  deadline: z.enum(['within7', 'within30', 'moreThan30']).optional(),
  sortBy: z
    .enum(['publishDate_desc', 'publishDate_asc', 'budget_desc', 'budget_asc', 'newest', 'oldest'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(12),
}).refine(
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
  category: z.enum(['Website', 'Mobile App', 'AI', 'Database', 'ERP', 'Cloud', 'Data Analytics', 'Information System']).optional(),
  department: z.string().max(200).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
  search: z.string().max(200).optional(),
  stats: z.enum(['true', 'false']).optional(),
  agencies: z.enum(['true', 'false']).optional(),
});

// ─── Bookmark (POST /api/bookmarks) ─────────────────────────────────────────

export const BookmarkCreateSchema = z.object({
  projectId: z.string().length(24), // MongoDB ObjectId hex
});

// ─── Settings (PUT /api/settings) ───────────────────────────────────────────

export const SettingsUpdateSchema = z.object({
  inAppNotif: z.boolean().optional(),
  emailNotif: z.boolean().optional(),
  dailyDigest: z.boolean().optional(),
  closingAlert: z.boolean().optional(),
  newProjectAlert: z.boolean().optional(),
  newOpportunity: z.boolean().optional(),
  savedUpdate: z.boolean().optional(),
  deadlineReminder: z.boolean().optional(),
  keywords: z.array(z.string().max(100)).max(30).optional(),
  interestTags: z.array(z.string().max(50)).max(20).optional(),
  agencies: z.array(z.string().max(150)).max(50).optional(),
  budgetMin: z.number().min(0).nullable().optional(),
  budgetMax: z.number().min(0).nullable().optional(),
  language: z.enum(['th', 'en']).optional(),
  email: z.string().email().nullable().optional(),
}).refine(
  (data) => {
    if (data.budgetMin != null && data.budgetMax != null) {
      return data.budgetMax >= data.budgetMin;
    }
    return true;
  },
  { message: 'budgetMax must be >= budgetMin', path: ['budgetMax'] },
);

// ─── Notification Preferences (PUT /api/notifications/preferences) ──────────

export const NotificationPreferencesSchema = z.object({
  inAppNotif: z.boolean().optional(),
  newOpportunity: z.boolean().optional(),
  savedUpdate: z.boolean().optional(),
  deadlineReminder: z.boolean().optional(),
  emailNotif: z.boolean().optional(),
  dailyDigest: z.boolean().optional(),
  keywords: z.array(z.string().max(100)).max(30).optional(),
  interestTags: z.array(z.string().max(50)).max(20).optional(),
  agencies: z.array(z.string().max(150)).max(50).optional(),
  budgetMin: z.number().min(0).nullable().optional(),
  budgetMax: z.number().min(0).nullable().optional(),
  language: z.enum(['th', 'en']).optional(),
  email: z.string().email().nullable().optional(),
}).refine(
  (data) => {
    if (data.budgetMin != null && data.budgetMax != null) {
      return data.budgetMax >= data.budgetMin;
    }
    return true;
  },
  { message: 'budgetMax must be >= budgetMin', path: ['budgetMax'] },
);

// ─── AI Extract (POST /api/ai/extract) ──────────────────────────────────────

export const AiExtractSchema = z.object({
  documentUrl: z.string().url().optional(),
  documentBase64: z.string().max(20_000_000).optional(), // ~15MB base64
}).refine(
  (d) => d.documentUrl || d.documentBase64,
  { message: 'Either documentUrl or documentBase64 must be provided' },
);

// ─── AI Classify (POST /api/ai/classify) ────────────────────────────────────

export const AiClassifySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
});

// ─── Ingestion: Discover (POST /api/ingestion/discover) ─────────────────────

export const IngestionDiscoverSchema = z.object({
  keyword: z.string().max(200).default('ซอฟต์แวร์'),
  fiscalYear: z.coerce.number().int().min(2500).max(2600).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(100),
});

// ─── Ingestion: Project ID (11 digits e-GP identifier) ──────────────────────

export const ProjectIdParamSchema = z.object({
  projectId: z
    .string()
    .trim()
    .regex(/^\d{11}$/, 'Project ID must contain exactly 11 numeric digits'),
});


// ─── Project Create & Update (Admin CRUD) ───────────────────────────────────

export const BilingualStringSchema = z.object({
  th: z.string().min(1).max(1000),
  en: z.string().min(1).max(1000),
});

export const BilingualArraySchema = z.object({
  th: z.array(z.string()).min(1),
  en: z.array(z.string()).min(1),
});

export const ProjectCreateSchema = z.object({
  externalId: z.coerce.number().int().positive().optional(),
  title: BilingualStringSchema,
  department: BilingualStringSchema,
  budget: z.coerce.number().min(0),
  publishDate: z.string().min(1),
  deadline: z.string().min(1),
  category: z.enum(['Website', 'Mobile App', 'AI', 'Database', 'ERP', 'Cloud', 'Data Analytics', 'Information System']),
  procurementType: z.string().min(1).max(200),
  description: BilingualStringSchema,
  scope: BilingualArraySchema,
  qualifications: BilingualArraySchema,
  historicalAvg: z.coerce.number().min(0).optional(),
  sourceDocument: z.string().optional().default(''),
  sourceUrl: z.string().optional(),
  documentUrl: z.string().optional(),
  aiConfidence: z.enum(['High', 'Medium', 'Low']).optional().default('High'),
  isSoftwareRelated: z.boolean().optional().default(true),                    // UC-10
  classificationReviewStatus: z                                               // UC-10
    .enum(['PENDING_REVIEW', 'APPROVED', 'CORRECTED'])
    .optional()
    .default('PENDING_REVIEW'),
});

export const ProjectUpdateSchema = ProjectCreateSchema.partial();

