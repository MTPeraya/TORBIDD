// =============================================================================
// lib/config.ts - Centralized Configuration Module & Environment Validation
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const IngestionConfigSchema = z.object({
  govspendingApiKey: z.string().trim().default(''),
  govspendingBaseUrl: z
    .string()
    .url()
    .default('https://opend.data.go.th/govspending/service/egp-contract'),
  egpBaseUrl: z
    .string()
    .url()
    .default('https://process5.gprocurement.go.th'),
  bmaBaseUrl: z
    .string()
    .url()
    .default('http://egp2.bangkok.go.th'),
  requestTimeoutMs: z.coerce.number().int().positive().default(15000),
  documentStoragePath: z.string().default('./storage/documents'),
});

export type IngestionConfig = z.infer<typeof IngestionConfigSchema> & {
  resolvedStoragePath: string;
};

/**
 * Validates and ensures the storage directory exists on disk.
 * If the path does not exist, it will be automatically created recursively.
 */
export function ensureStorageDirectoryExists(storagePath: string): string {
  const resolved = path.isAbsolute(storagePath)
    ? storagePath
    : path.resolve(/*turbopackIgnore: true*/ process.cwd(), storagePath);

  try {
    if (!fs.existsSync(resolved)) {
      fs.mkdirSync(resolved, { recursive: true });
    }
  } catch (err) {
    // If running in an environment with restricted disk permissions, warn gracefully
    console.warn(`[Config] Notice: Could not create directory at ${resolved}:`, err);
  }

  return resolved;
}

/**
 * Loads, validates, and returns the ingestion configuration.
 */
export function getIngestionConfig(
  env: Partial<NodeJS.ProcessEnv> | Record<string, string | undefined> = process.env,
): IngestionConfig {
  const rawConfig = {
    govspendingApiKey: env.GOVSPENDING_API_KEY ?? '',
    govspendingBaseUrl:
      env.GOVSPENDING_BASE_URL || 'https://opend.data.go.th/govspending/service/egp-contract',
    egpBaseUrl: env.EGP_BASE_URL || 'https://process5.gprocurement.go.th',
    bmaBaseUrl: env.BMA_BASE_URL || 'http://egp2.bangkok.go.th',
    requestTimeoutMs: env.REQUEST_TIMEOUT_MS ? Number(env.REQUEST_TIMEOUT_MS) : 15000,
    documentStoragePath: env.DOCUMENT_STORAGE_PATH || './storage/documents',
  };

  const parsed = IngestionConfigSchema.parse(rawConfig);
  const resolvedStoragePath = ensureStorageDirectoryExists(parsed.documentStoragePath);

  return {
    ...parsed,
    resolvedStoragePath,
  };
}

export const ingestionConfig = getIngestionConfig();
