/**
 * @jest-environment node
 */
// =============================================================================
// services/database/__tests__/sync-logs.test.ts
// Unit tests for SyncLog, SystemMetadata, and Last Successful Sync Timestamp Commit
// =============================================================================

import {
  recordSyncStart,
  recordSyncSuccess,
  recordSyncFailure,
  getSystemSyncMetadata,
  getRecentSyncLogs,
} from '../sync-logs';
import SyncLog from '@/models/SyncLog';
import SystemMetadata from '@/models/SystemMetadata';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/SyncLog');
jest.mock('@/models/SystemMetadata');

describe('SyncLogs & SystemMetadata Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. should record sync start with triggerType and return a log ID', async () => {
    const mockSave = jest.fn().mockResolvedValue(true);
    (SyncLog as unknown as jest.Mock).mockImplementation(() => ({
      _id: '67a1234567890abcdef12345',
      save: mockSave,
    }));

    const result = await recordSyncStart('scheduled', 'CKAN_GOVSPENDING');

    expect(result.logId).toBe('67a1234567890abcdef12345');
    expect(result.startedAt).toBeInstanceOf(Date);
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('2. should commit lastSuccessfulSyncAt only after batch completes without fatal errors', async () => {
    (SyncLog.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
    (SystemMetadata.findOneAndUpdate as jest.Mock).mockResolvedValue(true);

    const startedAt = new Date(Date.now() - 5000);
    await recordSyncSuccess('67a1234567890abcdef12345', {
      recordsSyncedCount: 20,
      triggerType: 'manual',
      startedAt,
    });

    expect(SyncLog.findByIdAndUpdate).toHaveBeenCalledWith(
      '67a1234567890abcdef12345',
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'SUCCESS',
          recordsSyncedCount: 20,
        }),
      }),
    );

    // Verify lastSuccessfulSyncAt is committed in SystemMetadata
    expect(SystemMetadata.findOneAndUpdate).toHaveBeenCalledWith(
      { key: 'procurement_sync' },
      expect.objectContaining({
        $set: expect.objectContaining({
          lastStatus: 'HEALTHY',
          recordsSyncedCount: 20,
          lastTriggerType: 'manual',
          lastSuccessfulSyncAt: expect.any(Date),
        }),
      }),
      expect.anything(),
    );
  });

  it('3. should NOT overwrite lastSuccessfulSyncAt when a sync fails with errors', async () => {
    (SyncLog.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);
    (SystemMetadata.findOneAndUpdate as jest.Mock).mockResolvedValue(true);

    await recordSyncFailure('67a1234567890abcdef12345', {
      errorMessage: 'Network timeout connection failed',
      triggerType: 'scheduled',
    });

    expect(SyncLog.findByIdAndUpdate).toHaveBeenCalledWith(
      '67a1234567890abcdef12345',
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'FAILED',
          errorMessage: 'Network timeout connection failed',
        }),
      }),
    );

    // Verify SystemMetadata does NOT update or overwrite lastSuccessfulSyncAt
    const metadataUpdateCall = (SystemMetadata.findOneAndUpdate as jest.Mock).mock.calls[0][1];
    expect(metadataUpdateCall.$set.lastSuccessfulSyncAt).toBeUndefined();
    expect(metadataUpdateCall.$set.lastStatus).toBe('DEGRADED');
    expect(metadataUpdateCall.$set.lastErrorMessage).toBe('Network timeout connection failed');
  });

  it('4. should retrieve system sync metadata and recent logs', async () => {
    (SystemMetadata.findOne as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        key: 'procurement_sync',
        lastSuccessfulSyncAt: new Date(),
        recordsSyncedCount: 40,
        lastStatus: 'HEALTHY',
      }),
    });

    const metadata = await getSystemSyncMetadata();
    expect(metadata).toBeDefined();
    expect(metadata!.recordsSyncedCount).toBe(40);

    (SyncLog.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ status: 'SUCCESS' }, { status: 'FAILED' }]),
        }),
      }),
    });

    const logs = await getRecentSyncLogs(5);
    expect(logs).toHaveLength(2);
  });
});
