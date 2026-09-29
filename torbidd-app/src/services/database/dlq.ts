// =============================================================================
// services/database/dlq.ts - Dead Letter Queue (DLQ) Database Service
// =============================================================================

import connectToDatabase from '@/lib/mongodb';
import SyncError, { ISyncError, DlqStatus } from '@/models/SyncError';

export interface EnqueueSyncErrorParams {
  errorCode: string;
  errorMessage: string;
  requestUrl?: string;
  requestParameters?: Record<string, unknown>;
  stackTrace?: string;
  payloadSnippet?: string;
  retryCount?: number;
  source?: string;
}

/**
 * Enqueue a failed synchronization request into the Dead Letter Queue (DLQ).
 * Captures error codes, request parameters, stack traces, and payload snippets.
 */
export async function enqueueSyncError(params: EnqueueSyncErrorParams): Promise<ISyncError> {
  await connectToDatabase();

  const snippet = params.payloadSnippet
    ? params.payloadSnippet.slice(0, 1000)
    : undefined;

  const dlqItem = new SyncError({
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    requestUrl: params.requestUrl,
    requestParameters: params.requestParameters || {},
    stackTrace: params.stackTrace,
    payloadSnippet: snippet,
    retryCount: params.retryCount ?? 3,
    source: params.source || 'CKAN_GOVSPENDING',
    status: 'PENDING',
    alertSent: false,
  });

  return await dlqItem.save();
}

/**
 * Retrieve pending errors from the Dead Letter Queue for investigation and manual retry.
 */
export async function getPendingDlqItems(limit = 20): Promise<ISyncError[]> {
  try {
    await connectToDatabase();
    return SyncError.find({ status: 'PENDING' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean() as unknown as Promise<ISyncError[]>;
  } catch (err) {
    console.warn('[DLQ] Could not retrieve pending DLQ items:', err);
    return [];
  }
}

/**
 * Mark a DLQ item as RESOLVED or DISCARDED.
 */
export async function updateDlqItemStatus(
  id: string,
  status: DlqStatus,
  notes?: string,
  resolvedBy = 'system_admin',
): Promise<ISyncError | null> {
  await connectToDatabase();
  return SyncError.findByIdAndUpdate(
    id,
    {
      $set: {
        status,
        resolutionNotes: notes,
        resolvedBy,
        resolvedAt: new Date(),
      },
    },
    { new: true },
  ).lean() as unknown as Promise<ISyncError | null>;
}

/**
 * Mark that an alert notification was successfully dispatched for this DLQ entry.
 */
export async function markAlertSent(id: string): Promise<void> {
  try {
    await connectToDatabase();
    await SyncError.findByIdAndUpdate(id, {
      $set: {
        alertSent: true,
        alertSentAt: new Date(),
      },
    });
  } catch (err) {
    console.warn('[DLQ] Could not mark alert sent:', err);
  }
}

/**
 * Get aggregate summary stats of the Dead Letter Queue.
 */
export async function getDlqStats(): Promise<{
  pendingCount: number;
  resolvedCount: number;
  discardedCount: number;
  totalCount: number;
}> {
  try {
    await connectToDatabase();
    const [pendingCount, resolvedCount, discardedCount, totalCount] = await Promise.all([
      SyncError.countDocuments({ status: 'PENDING' }),
      SyncError.countDocuments({ status: 'RESOLVED' }),
      SyncError.countDocuments({ status: 'DISCARDED' }),
      SyncError.countDocuments({}),
    ]);
    return { pendingCount, resolvedCount, discardedCount, totalCount };
  } catch {
    return { pendingCount: 0, resolvedCount: 0, discardedCount: 0, totalCount: 0 };
  }
}
