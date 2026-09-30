// =============================================================================
// services/ingestion/sync-state.ts - Ingestion Sync State & 5-Hour Scheduler
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { IngestionService } from './ingestion.service';
import { DiscoveredProject } from '@/types/procurement';
import {
  recordSyncStart,
  recordSyncSuccess,
  recordSyncFailure,
} from '@/services/database/sync-logs';
import { enqueueSyncError } from '@/services/database/dlq';
import { alertService } from '@/services/notifications/alert-service';
import { SyncTriggerType } from '@/models/SyncLog';
import { SystemHealthStatus } from '@/models/SystemMetadata';

export interface SyncStatus {
  lastSuccessfulSyncAt: string;
  lastAttemptAt: string;
  lastSyncAt: string; // Alias for backward compatibility
  nextSyncAt: string;
  syncIntervalHours: number;
  triggerType: SyncTriggerType;
  recordsSyncedCount: number;
  health: SystemHealthStatus;
  status: 'idle' | 'syncing' | 'success' | 'error';
  totalDiscovered: number;
  lastDiscoveredCount: number;
  lastError: string | null;
  source: string;
}

const STORAGE_DIR = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'storage');
const STATE_FILE = path.join(STORAGE_DIR, 'sync-state.json');
const DISCOVERED_CACHE_FILE = path.join(STORAGE_DIR, 'discovered-projects.json');
const SYNC_INTERVAL_HOURS = 5;
const SYNC_INTERVAL_MS = SYNC_INTERVAL_HOURS * 60 * 60 * 1000;

function ensureStorage(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Get current sync state from file or initialize with defaults.
 */
export function getSyncStatus(): SyncStatus {
  ensureStorage();

  const now = new Date();
  const defaultSuccessful = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const defaultState: SyncStatus = {
    lastSuccessfulSyncAt: defaultSuccessful,
    lastAttemptAt: defaultSuccessful,
    lastSyncAt: defaultSuccessful,
    nextSyncAt: new Date(now.getTime() + (SYNC_INTERVAL_HOURS * 3600 * 1000 - 10 * 60 * 1000)).toISOString(),
    syncIntervalHours: SYNC_INTERVAL_HOURS,
    triggerType: 'scheduled',
    recordsSyncedCount: 0,
    health: 'HEALTHY',
    status: 'idle',
    totalDiscovered: 0,
    lastDiscoveredCount: 0,
    lastError: null,
    source: 'CKAN_GOVSPENDING & National e-GP',
  };

  if (!fs.existsSync(STATE_FILE)) {
    try {
      fs.writeFileSync(STATE_FILE, JSON.stringify(defaultState, null, 2), 'utf-8');
    } catch {}
    return defaultState;
  }

  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...defaultState,
      ...parsed,
      // Ensure lastSuccessfulSyncAt is always populated
      lastSuccessfulSyncAt: parsed.lastSuccessfulSyncAt || parsed.lastSyncAt || defaultSuccessful,
      lastAttemptAt: parsed.lastAttemptAt || parsed.lastSyncAt || defaultSuccessful,
      triggerType: parsed.triggerType || 'scheduled',
      health: parsed.health || (parsed.status === 'error' ? 'DEGRADED' : 'HEALTHY'),
    };
  } catch {
    return defaultState;
  }
}

/**
 * Persist sync state updates.
 */
export function saveSyncStatus(update: Partial<SyncStatus>): SyncStatus {
  ensureStorage();
  const current = getSyncStatus();
  const updated: SyncStatus = {
    ...current,
    ...update,
    // Keep lastSyncAt in sync with lastSuccessfulSyncAt for backward compatibility
    lastSyncAt: update.lastSuccessfulSyncAt || current.lastSuccessfulSyncAt,
  };

  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SyncState] Could not save sync status:', err);
  }

  return updated;
}

/**
 * Read cached discovered projects from local storage.
 */
export function getCachedDiscoveredProjects(): DiscoveredProject[] {
  ensureStorage();
  if (!fs.existsSync(DISCOVERED_CACHE_FILE)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(DISCOVERED_CACHE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save discovered projects to local cache for instant UI rendering.
 */
export function cacheDiscoveredProjects(projects: DiscoveredProject[]): void {
  ensureStorage();
  try {
    const existing = getCachedDiscoveredProjects();
    const map = new Map<string, DiscoveredProject>();

    // Index existing
    for (const p of existing) {
      map.set(p.externalProjectId, p);
    }
    // Merge new
    for (const p of projects) {
      map.set(p.externalProjectId, p);
    }

    const merged = Array.from(map.values());
    fs.writeFileSync(DISCOVERED_CACHE_FILE, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[SyncState] Could not cache discovered projects:', err);
  }
}

/**
 * Trigger immediate ingestion and schedule next 5-hour cycle.
 * Commits lastSuccessfulSyncAt only after the entire batch transaction completes without fatal errors.
 */
export async function triggerImmediateSync(options: {
  keyword?: string;
  fiscalYear?: number;
  limit?: number;
  triggerType?: SyncTriggerType;
} = {}): Promise<{
  success: boolean;
  total: number;
  upsertedCount: number;
  projects: DiscoveredProject[];
  syncStatus: SyncStatus;
}> {
  const triggerType = options.triggerType || 'manual';
  const now = new Date();

  // 1. Record sync start in DB and local state
  const { logId, startedAt } = await recordSyncStart(triggerType);
  saveSyncStatus({
    status: 'syncing',
    lastAttemptAt: now.toISOString(),
    triggerType,
    lastError: null,
  });

  try {
    const service = new IngestionService();
    const result = await service.discoverProjects({
      keyword: options.keyword || 'ซอฟต์แวร์',
      fiscalYear: options.fiscalYear,
      limit: options.limit || 1000,
    });

    if (result.projects && result.projects.length > 0) {
      cacheDiscoveredProjects(result.projects);
    }

    const completedAt = new Date();
    const nextSync = new Date(completedAt.getTime() + SYNC_INTERVAL_MS);
    const cachedTotal = getCachedDiscoveredProjects().length;

    // 2. Commit success to DB (Commits lastSuccessfulSyncAt only now!)
    await recordSyncSuccess(logId, {
      recordsSyncedCount: result.projects.length,
      triggerType,
      nextScheduledSyncAt: nextSync,
      startedAt,
      details: {
        total: result.total,
        upsertedCount: result.upsertedCount,
        modifiedCount: result.modifiedCount,
      },
    });

    // 3. Update local state
    const newStatus = saveSyncStatus({
      status: 'success',
      health: 'HEALTHY',
      lastSuccessfulSyncAt: completedAt.toISOString(),
      lastAttemptAt: completedAt.toISOString(),
      nextSyncAt: nextSync.toISOString(),
      triggerType,
      recordsSyncedCount: result.projects.length,
      totalDiscovered: cachedTotal || result.total,
      lastDiscoveredCount: result.projects.length,
      lastError: null,
    });

    return {
      success: true,
      total: result.total,
      upsertedCount: result.upsertedCount,
      projects: result.projects,
      syncStatus: newStatus,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const failedAt = new Date();

    // 1. Record failure in DB (Preserves existing lastSuccessfulSyncAt)
    await recordSyncFailure(logId, {
      errorMessage: message,
      triggerType,
      startedAt,
    });

    // 2. Enqueue into Dead Letter Queue (DLQ) with parameters, stack trace, and error code
    let dlqId: string | undefined;
    try {
      const errorCode = message.includes('429')
        ? 'HTTP_429_RATE_LIMIT'
        : message.includes('50')
        ? 'HTTP_5XX_SERVER_ERROR'
        : message.includes('timeout') || message.includes('ETIMEDOUT')
        ? 'NETWORK_TIMEOUT'
        : message.includes('authentication')
        ? 'AUTHENTICATION_ERROR'
        : 'SYNC_FATAL_ERROR';

      const dlqItem = await enqueueSyncError({
        errorCode,
        errorMessage: message,
        requestUrl: `keyword=${options.keyword || 'ซอฟต์แวร์'}&fiscalYear=${options.fiscalYear || 'default'}`,
        requestParameters: {
          keyword: options.keyword,
          fiscalYear: options.fiscalYear,
          limit: options.limit,
          triggerType,
        },
        stackTrace: err instanceof Error ? err.stack : undefined,
        payloadSnippet: message,
        retryCount: 3,
        source: 'CKAN_GOVSPENDING',
      });
      dlqId = dlqItem._id.toString();
    } catch (dlqErr) {
      console.warn('[SyncState] Could not record into DLQ:', dlqErr);
    }

    // 3. Dispatch Alert Trigger (Slack / LINE / Webhook) when retries exceed maximum threshold limits
    try {
      await alertService.sendRetryExceededAlert({
        errorCode: message.includes('429') ? 'HTTP_429_RATE_LIMIT' : 'SYNC_RETRIES_EXCEEDED',
        errorMessage: message,
        source: 'CKAN_GOVSPENDING',
        retryAttempts: 3,
        maxAttempts: 3,
        requestParameters: {
          keyword: options.keyword,
          fiscalYear: options.fiscalYear,
          limit: options.limit,
          triggerType,
        },
        dlqId,
        occurredAt: failedAt,
      });
    } catch (alertErr) {
      console.warn('[SyncState] Could not dispatch alert notification:', alertErr);
    }

    // 4. Update local state without overwriting lastSuccessfulSyncAt
    saveSyncStatus({
      status: 'error',
      health: 'DEGRADED',
      lastAttemptAt: failedAt.toISOString(),
      // NOTICE: lastSuccessfulSyncAt is NOT updated here!
      nextSyncAt: new Date(failedAt.getTime() + 15 * 60 * 1000).toISOString(), // retry in 15 mins on error
      lastError: message,
      triggerType,
    });

    throw new Error(`Sync failed: ${message}`);
  }
}

/**
 * Check if 5 hours have elapsed since last sync, and auto-sync if needed.
 */
export async function checkAndAutoSync(): Promise<void> {
  const status = getSyncStatus();
  const lastSyncTime = new Date(status.lastSuccessfulSyncAt || status.lastSyncAt).getTime();
  const nowTime = Date.now();

  if (nowTime - lastSyncTime >= SYNC_INTERVAL_MS && status.status !== 'syncing') {
    console.log('[AutoSync] 5 hours elapsed since last sync. Initiating scheduled sync...');
    try {
      await triggerImmediateSync({ triggerType: 'scheduled' });
    } catch (err) {
      console.warn('[AutoSync] Scheduled sync cycle encountered an issue:', err);
    }
  }
}
