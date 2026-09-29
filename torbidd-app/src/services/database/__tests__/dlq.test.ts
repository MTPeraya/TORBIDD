/**
 * @jest-environment node
 */
// =============================================================================
// services/database/__tests__/dlq.test.ts
// Unit tests for Dead Letter Queue (DLQ) & Sync Errors Database Service
// =============================================================================

import {
  enqueueSyncError,
  getPendingDlqItems,
  updateDlqItemStatus,
  markAlertSent,
  getDlqStats,
} from '../dlq';
import SyncError from '@/models/SyncError';

jest.mock('@/lib/mongodb', () => jest.fn().mockResolvedValue(true));
jest.mock('@/models/SyncError');

describe('Dead Letter Queue (DLQ) Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. should enqueue a sync error with code, parameters, stack trace, and snippet', async () => {
    const mockSave = jest.fn().mockResolvedValue({
      _id: 'dlq-12345',
      errorCode: 'HTTP_429_RATE_LIMIT',
      status: 'PENDING',
    });

    (SyncError as unknown as jest.Mock).mockImplementation((data) => ({
      ...data,
      _id: 'dlq-12345',
      save: mockSave,
    }));

    const result = await enqueueSyncError({
      errorCode: 'HTTP_429_RATE_LIMIT',
      errorMessage: 'Rate limit exceeded on opend.data.go.th',
      requestUrl: 'https://opend.data.go.th/govspending/service/egp-contract?keyword=ซอฟต์แวร์',
      requestParameters: { keyword: 'ซอฟต์แวร์', fiscalYear: 2568 },
      stackTrace: 'Error: Rate limit exceeded\n    at fetchPage (govspending-client.ts:183)',
      payloadSnippet: '{"success":false,"error":"rate_limit_exceeded"}',
      retryCount: 3,
      source: 'CKAN_GOVSPENDING',
    });

    expect(result).toBeDefined();
    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(SyncError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'HTTP_429_RATE_LIMIT',
        status: 'PENDING',
        retryCount: 3,
        payloadSnippet: '{"success":false,"error":"rate_limit_exceeded"}',
      }),
    );
  });

  it('2. should retrieve pending DLQ items and stats', async () => {
    (SyncError.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([
            { errorCode: 'HTTP_500', status: 'PENDING' },
            { errorCode: 'TIMEOUT', status: 'PENDING' },
          ]),
        }),
      }),
    });

    const pending = await getPendingDlqItems(10);
    expect(pending).toHaveLength(2);

    (SyncError.countDocuments as jest.Mock)
      .mockResolvedValueOnce(2) // pending
      .mockResolvedValueOnce(5) // resolved
      .mockResolvedValueOnce(1) // discarded
      .mockResolvedValueOnce(8); // total

    const stats = await getDlqStats();
    expect(stats.pendingCount).toBe(2);
    expect(stats.resolvedCount).toBe(5);
    expect(stats.totalCount).toBe(8);
  });

  it('3. should update DLQ item status to RESOLVED with notes and resolver', async () => {
    (SyncError.findByIdAndUpdate as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        _id: 'dlq-12345',
        status: 'RESOLVED',
        resolvedBy: 'system_admin',
      }),
    });

    const updated = await updateDlqItemStatus('dlq-12345', 'RESOLVED', 'Manual resync succeeded');
    expect(updated?.status).toBe('RESOLVED');
    expect(SyncError.findByIdAndUpdate).toHaveBeenCalledWith(
      'dlq-12345',
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'RESOLVED',
          resolutionNotes: 'Manual resync succeeded',
          resolvedBy: 'system_admin',
        }),
      }),
      { new: true },
    );
  });

  it('4. should mark alert sent in DLQ entry', async () => {
    (SyncError.findByIdAndUpdate as jest.Mock).mockResolvedValue(true);

    await markAlertSent('dlq-12345');
    expect(SyncError.findByIdAndUpdate).toHaveBeenCalledWith(
      'dlq-12345',
      expect.objectContaining({
        $set: expect.objectContaining({
          alertSent: true,
          alertSentAt: expect.any(Date),
        }),
      }),
    );
  });
});
