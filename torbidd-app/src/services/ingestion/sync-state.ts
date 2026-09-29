// =============================================================================
// services/ingestion/sync-state.ts - Ingestion Sync State & 5-Hour Scheduler
// =============================================================================

import fs from 'node:fs';
import path from 'node:path';
import { IngestionService } from './ingestion.service';
import { DiscoveredProject } from '@/types/procurement';

export interface SyncStatus {
  lastSyncAt: string;
  nextSyncAt: string;
  syncIntervalHours: number;
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
  const defaultState: SyncStatus = {
    lastSyncAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
    nextSyncAt: new Date(now.getTime() + (SYNC_INTERVAL_HOURS * 3600 * 1000 - 10 * 60 * 1000)).toISOString(),
    syncIntervalHours: SYNC_INTERVAL_HOURS,
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
    return { ...defaultState, ...JSON.parse(raw) };
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
  const updated: SyncStatus = { ...current, ...update };

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
 */
export async function triggerImmediateSync(options: {
  keyword?: string;
  fiscalYear?: number;
  limit?: number;
} = {}): Promise<{
  success: boolean;
  total: number;
  upsertedCount: number;
  projects: DiscoveredProject[];
  syncStatus: SyncStatus;
}> {
  saveSyncStatus({ status: 'syncing', lastError: null });

  try {
    const service = new IngestionService();
    const result = await service.discoverProjects({
      keyword: options.keyword || 'ซอฟต์แวร์',
      fiscalYear: options.fiscalYear,
      limit: options.limit || 20,
    });

    if (result.projects && result.projects.length > 0) {
      cacheDiscoveredProjects(result.projects);
    }

    const now = new Date();
    const nextSync = new Date(now.getTime() + SYNC_INTERVAL_MS);
    const cachedTotal = getCachedDiscoveredProjects().length;

    const newStatus = saveSyncStatus({
      status: 'success',
      lastSyncAt: now.toISOString(),
      nextSyncAt: nextSync.toISOString(),
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
    const now = new Date();
    const errorStatus = saveSyncStatus({
      status: 'error',
      lastSyncAt: now.toISOString(),
      nextSyncAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(), // retry in 15 mins on error
      lastError: message,
    });

    throw new Error(`Sync failed: ${message}`);
  }
}

/**
 * Check if 5 hours have elapsed since last sync, and auto-sync if needed.
 */
export async function checkAndAutoSync(): Promise<void> {
  const status = getSyncStatus();
  const lastSyncTime = new Date(status.lastSyncAt).getTime();
  const nowTime = Date.now();

  if (nowTime - lastSyncTime >= SYNC_INTERVAL_MS && status.status !== 'syncing') {
    console.log('[AutoSync] 5 hours elapsed since last sync. Initiating automatic procurement sync...');
    try {
      await triggerImmediateSync();
    } catch (err) {
      console.warn('[AutoSync] Auto-sync cycle encountered an issue:', err);
    }
  }
}
