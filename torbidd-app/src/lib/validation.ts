// =============================================================================
// lib/validation.ts - Zod Schemas for API Input Validation
// =============================================================================

import { z } from 'zod';

// ─── Project Filters (GET /api/projects) ────────────────────────────────────

export const ProjectFiltersSchema = z.object({
  search: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  category: z.enum(['Website', 'Mobile App', 'AI', 'Database']).optional(),
  budget: z.enum(['under5m', '5to10', '10to20', 'above20m']).optional(),
  deadline: z.enum(['within7', 'within30', 'moreThan30']).optional(),
});

// ─── Historical Filters (GET /api/historical) ───────────────────────────────

export const HistoricalFiltersSchema = z.object({
  category: z.enum(['Website', 'Mobile App', 'AI', 'Database']).optional(),
  department: z.string().max(200).optional(),
  year: z.coerce.number().int().min(2000).max(2200).optional(),
});

// ─── Bookmark (POST /api/bookmarks) ─────────────────────────────────────────

export const BookmarkCreateSchema = z.object({
  projectId: z.string().length(24), // MongoDB ObjectId hex
});

// ─── Settings (PUT /api/settings) ───────────────────────────────────────────

export const SettingsUpdateSchema = z.object({
  emailNotif: z.boolean().optional(),
  dailyDigest: z.boolean().optional(),
  closingAlert: z.boolean().optional(),
  newProjectAlert: z.boolean().optional(),
  interestTags: z.array(z.string().max(50)).max(20).optional(),
  budgetMin: z.number().min(0).nullable().optional(),
  budgetMax: z.number().min(0).nullable().optional(),
  language: z.enum(['th', 'en']).optional(),
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
