/**
 * @jest-environment node
 */
// =============================================================================
// services/notifications/__tests__/alert-service.test.ts
// Unit tests for Alert Notification Service (Slack, LINE, Webhook & Dry-run)
// =============================================================================

import { AlertService } from '../alert-service';
import * as dlqDb from '@/services/database/dlq';

jest.mock('@/services/database/dlq', () => ({
  markAlertSent: jest.fn().mockResolvedValue(true),
}));

describe('AlertService (Slack, LINE, Webhook & Alert Triggers)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. should dispatch alert to Slack webhook with rich block formatting', async () => {
    let sentBody: Record<string, unknown> = {};
    const mockFetch = jest.fn().mockImplementation(async (_url, init) => {
      sentBody = JSON.parse(init.body);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const service = new AlertService({
      webhookUrl: 'https://hooks.slack.com/services/T00/B00/XXXX',
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const result = await service.sendRetryExceededAlert({
      errorCode: 'HTTP_429_RATE_LIMIT',
      errorMessage: 'Central API rate limit exceeded after 3 attempts',
      source: 'CKAN_GOVSPENDING',
      retryAttempts: 3,
      maxAttempts: 3,
      dlqId: 'dlq-671234',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.dispatched).toBe(true);
    expect(result.channel).toBe('slack');
    expect(sentBody.text).toContain('TORBIDD Critical Alert');
    expect(dlqDb.markAlertSent).toHaveBeenCalledWith('dlq-671234');
  });

  it('2. should dispatch alert to LINE Notify when LINE token is configured', async () => {
    let authHeader = '';
    let sentFormData = '';
    const mockFetch = jest.fn().mockImplementation(async (_url, init) => {
      authHeader = init.headers.Authorization;
      sentFormData = String(init.body);
      return new Response(JSON.stringify({ status: 200, message: 'ok' }), { status: 200 });
    });

    const service = new AlertService({
      lineNotifyToken: 'line-test-token-12345',
      fetchImpl: mockFetch as unknown as typeof fetch,
    });

    const result = await service.sendRetryExceededAlert({
      errorCode: 'HTTP_500_SERVER_ERROR',
      errorMessage: 'Internal Server Error on e-GP endpoint',
      source: 'NATIONAL_EGP',
      retryAttempts: 3,
      maxAttempts: 3,
      dlqId: 'dlq-998877',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.dispatched).toBe(true);
    expect(result.channel).toBe('line');
    expect(authHeader).toBe('Bearer line-test-token-12345');
    expect(decodeURIComponent(sentFormData.replace(/\+/g, ' '))).toContain('TORBIDD Critical Alert');
    expect(dlqDb.markAlertSent).toHaveBeenCalledWith('dlq-998877');
  });

  it('3. should safely log to console dry-run when no external webhook is configured', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const service = new AlertService({
      webhookUrl: '',
      lineNotifyToken: '',
    });

    const result = await service.sendRetryExceededAlert({
      errorCode: 'NETWORK_TIMEOUT',
      errorMessage: 'Gateway timed out after 3 retries',
      source: 'CKAN_GOVSPENDING',
      retryAttempts: 3,
      maxAttempts: 3,
      dlqId: 'dlq-112233',
    });

    expect(result.dispatched).toBe(true);
    expect(result.channel).toBe('console_dry_run');
    expect(consoleSpy).toHaveBeenCalled();
    expect(dlqDb.markAlertSent).toHaveBeenCalledWith('dlq-112233');

    consoleSpy.mockRestore();
  });
});
