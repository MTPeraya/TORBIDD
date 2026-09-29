// =============================================================================
// services/database/sync-logs.ts - Sync Logs & System Metadata Database Service
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import SyncLog, { ISyncLog, SyncTriggerType } from '@/models/SyncLog';
import SystemMetadata, { ISystemMetadata } from '@/models/SystemMetadata';

const METADATA_KEY = 'procurement_sync';

export interface SyncStartResult {
  logId: string;
  startedAt: Date;
}

/**
 * Record the start of a synchronization run in the database.
 */
export async function recordSyncStart(
  triggerType: SyncTriggerType = 'manual',
  source = 'CKAN_GOVSPENDING & National e-GP',
): Promise<SyncStartResult> {
  const startedAt = new Date();
  try {
    await connectToDatabase();
    const log = new SyncLog({
      triggerType,
      status: 'IN_PROGRESS',
      recordsSyncedCount: 0,
      source,
      startedAt,
    });
    await log.save();
    return { logId: log._id.toString(), startedAt };
  } catch (err) {
    console.warn('[SyncLogs] Could not record sync start in DB:', err);
    return { logId: `local-${Date.now()}`, startedAt };
  }
}

/**
 * Record the successful completion of a synchronization batch.
 * Commits lastSuccessfulSyncAt only after the entire batch transaction completes without errors.
 */
export async function recordSyncSuccess(
  logId: string,
  params: {
    recordsSyncedCount: number;
    triggerType: SyncTriggerType;
    nextScheduledSyncAt?: Date;
    details?: Record<string, unknown>;
    startedAt?: Date;
  },
): Promise<void> {
  const completedAt = new Date();
  const durationMs = params.startedAt ? completedAt.getTime() - params.startedAt.getTime() : 0;

  try {
    await connectToDatabase();

    // 1. Update SyncLog entry
    if (logId && !logId.startsWith('local-')) {
      await SyncLog.findByIdAndUpdate(logId, {
        $set: {
          status: 'SUCCESS',
          recordsSyncedCount: params.recordsSyncedCount,
          completedAt,
          durationMs,
          details: params.details || {},
        },
      });
    }

    // 2. Commit lastSuccessfulSyncAt in SystemMetadata (Only on Success!)
    await SystemMetadata.findOneAndUpdate(
      { key: METADATA_KEY },
      {
        $set: {
          lastSuccessfulSyncAt: completedAt,
          lastAttemptAt: completedAt,
          lastStatus: 'HEALTHY',
          recordsSyncedCount: params.recordsSyncedCount,
          lastTriggerType: params.triggerType,
          lastErrorMessage: null,
          nextScheduledSyncAt: params.nextScheduledSyncAt,
          metadata: params.details || {},
        },
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.warn('[SyncLogs] Could not record sync success in DB:', err);
  }
}

/**
 * Record a synchronization failure.
 * Preserves the previous lastSuccessfulSyncAt (Does NOT overwrite it).
 */
export async function recordSyncFailure(
  logId: string,
  params: {
    errorMessage: string;
    triggerType: SyncTriggerType;
    details?: Record<string, unknown>;
    startedAt?: Date;
  },
): Promise<void> {
  const failedAt = new Date();
  const durationMs = params.startedAt ? failedAt.getTime() - params.startedAt.getTime() : 0;

  try {
    await connectToDatabase();

    // 1. Update SyncLog entry
    if (logId && !logId.startsWith('local-')) {
      await SyncLog.findByIdAndUpdate(logId, {
        $set: {
          status: 'FAILED',
          errorMessage: params.errorMessage,
          completedAt: failedAt,
          durationMs,
          details: params.details || {},
        },
      });
    }

    // 2. Update SystemMetadata without overwriting lastSuccessfulSyncAt!
    await SystemMetadata.findOneAndUpdate(
      { key: METADATA_KEY },
      {
        $set: {
          lastAttemptAt: failedAt,
          lastStatus: 'DEGRADED',
          lastTriggerType: params.triggerType,
          lastErrorMessage: params.errorMessage,
        },
      },
      { upsert: true, new: true },
    );
  } catch (err) {
    console.warn('[SyncLogs] Could not record sync failure in DB:', err);
  }
}

/**
 * Retrieve the current system metadata and last successful sync timestamp.
 */
export async function getSystemSyncMetadata(): Promise<ISystemMetadata | null> {
  try {
    await connectToDatabase();
    return SystemMetadata.findOne({ key: METADATA_KEY }).lean() as unknown as Promise<ISystemMetadata | null>;
  } catch {
    return null;
  }
}

/**
 * Retrieve recent sync logs for admin health inspection and traceability.
 */
export async function getRecentSyncLogs(limit = 10): Promise<ISyncLog[]> {
  try {
    await connectToDatabase();
    return SyncLog.find({})
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean() as unknown as Promise<ISyncLog[]>;
  } catch {
    return [];
  }
}
