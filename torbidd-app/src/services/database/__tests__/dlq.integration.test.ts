/**
 * @jest-environment node
 */
// =============================================================================
// services/database/__tests__/dlq.integration.test.ts
// Integration tests for DLQ service against isolated mongodb-memory-server
// =============================================================================

import { setupTestDatabase } from '@/test/db-handler';
import {
  enqueueSyncError,
  getPendingDlqItems,
  updateDlqItemStatus,
  markAlertSent,
  getDlqStats,
} from '../dlq';
import SyncError from '@/models/SyncError';

describe('Dead Letter Queue (DLQ) Database Integration', () => {
  // Configures mongodb-memory-server and clears collections between each test
  setupTestDatabase();

  it('persists a sync error document to the isolated database', async () => {
    const errorDoc = await enqueueSyncError({
      errorCode: 'INTEGRATION_404',
      errorMessage: 'EGP procurement project endpoint not found',
      requestUrl: 'https://data.go.th/api/3/action/package_show',
      requestParameters: { id: 'test-dataset' },
      stackTrace: 'Error: Not Found at client.ts:42',
      payloadSnippet: '{"error": "not_found"}',
      retryCount: 2,
      source: 'EGP',
    });

    expect(errorDoc).toBeDefined();
    expect(errorDoc._id).toBeDefined();
    expect(errorDoc.errorCode).toBe('INTEGRATION_404');
    expect(errorDoc.status).toBe('PENDING');

    // Verify it actually exists in the MongoDB database
    const saved = await SyncError.findById(errorDoc._id);
    expect(saved).not.toBeNull();
    expect(saved?.errorCode).toBe('INTEGRATION_404');
    expect(saved?.errorMessage).toBe('EGP procurement project endpoint not found');
  });

  it('guarantees isolated test state (database starts clean for each test)', async () => {
    // The previous test inserted a document; afterEach lifecycle hook must have wiped it
    const pendingItems = await getPendingDlqItems(10);
    expect(pendingItems).toHaveLength(0);

    const stats = await getDlqStats();
    expect(stats.totalCount).toBe(0);
    expect(stats.pendingCount).toBe(0);
  });

  it('supports status transitions and statistics calculations', async () => {
    const err1 = await enqueueSyncError({
      errorCode: 'ERR_1',
      errorMessage: 'Timeout error',
      source: 'BMA',
    });

    const err2 = await enqueueSyncError({
      errorCode: 'ERR_2',
      errorMessage: 'Rate limit error',
      source: 'CKAN_GOVSPENDING',
    });

    // Update err1 to RESOLVED
    const resolved = await updateDlqItemStatus(
      String(err1._id),
      'RESOLVED',
      'Resolved via manual batch replay',
      'test_admin',
    );
    expect(resolved?.status).toBe('RESOLVED');
    expect(resolved?.resolvedBy).toBe('test_admin');

    // Mark err2 alert as sent
    await markAlertSent(String(err2._id));

    const updatedErr2 = await SyncError.findById(err2._id);
    expect(updatedErr2?.alertSent).toBe(true);
    expect(updatedErr2?.alertSentAt).toBeDefined();

    // Verify stats
    const stats = await getDlqStats();
    expect(stats.totalCount).toBe(2);
    expect(stats.pendingCount).toBe(1);
    expect(stats.resolvedCount).toBe(1);
  });
});

