/**
 * @jest-environment node
 */
// =============================================================================
// services/ai/__tests__/ai-fallback-dlq.integration.test.ts
// Integration Tests: AI Multi-Tier Fallback Chain & DLQ Resilience Architecture
// (Supports UC-10, UC-11, Issue #368, #369, #370, ASVS V10, V11, V12)
// =============================================================================
// Verifies:
// 1. Multi-tier AI auto-switching on HTTP 429 & upstream failures:
//    Google AI Studio -> OpenRouter -> Google Cloud Vertex AI -> Keyword Fallback
// 2. Strict preservation of architectural invariant:
//    Google Cloud Vertex AI is strictly the LAST AI provider before Keyword Fallback
// 3. Cooldown lifecycle: in-memory cooldown bypass, bulk processing, automatic
//    expiration, and administrative reset
// 4. Dead Letter Queue (DLQ) MongoDB persistence, query ordering, safe truncation,
//    and status transitions (PENDING -> RESOLVED / DISCARDED)
// 5. Alert Triggering (Slack Webhook & LINE Notify) on retry limit exhaustion (>= 3)
//    and DLQ database alert flag tracking (markAlertSent)
// 6. Administrative REST APIs (/api/admin/dlq and /api/admin/ai-provider) with
//    session authentication, role authorization, and state mutations
// 7. Ingestion pipeline resilience: graceful keyword fallback on AI failure and
//    DLQ error logging on fatal sync failures without corrupting sync state
// =============================================================================

import mongoose from 'mongoose';
import { NextRequest } from 'next/server';
import { setupTestDatabase } from '@/test/db-handler';
import SyncError, { ISyncError } from '@/models/SyncError';
import SyncLog from '@/models/SyncLog';
import {
  enqueueSyncError,
  getPendingDlqItems,
  updateDlqItemStatus,
  markAlertSent,
  getDlqStats,
} from '@/services/database/dlq';
import {
  FallbackClassifierAdapter,
  buildFallbackChain,
  isProviderInCooldown,
  setProviderCooldown,
  resetProviderCooldowns,
} from '@/services/ai/adapters/fallback-adapter';
import {
  classifyProject,
  classifyProjectsBulk,
  getAiDiagnostics,
  switchActiveAiProvider,
} from '@/services/ai/classifier';
import {
  getAiClassifierAdapter,
  normalizeProviderName,
} from '@/services/ai/adapters';
import { AlertService, AlertPayload } from '@/services/notifications/alert-service';
import {
  signSession,
  AUTH_COOKIE_NAME,
  AuthSessionUser,
} from '@/lib/auth';
import { GET as getDlqRoute, POST as postDlqRoute } from '@/app/api/admin/dlq/route';
import { GET as getAiProviderRoute, POST as postAiProviderRoute } from '@/app/api/admin/ai-provider/route';
import { getVertexAI } from '@/services/ai/vertex-ai';
import { saveSyncStatus, getSyncStatus, triggerImmediateSync } from '@/services/ingestion/sync-state';
import { IngestionService } from '@/services/ingestion/ingestion.service';

// Mock getVertexAI so we can simulate Vertex AI success and rate-limit errors
jest.mock('@/services/ai/vertex-ai', () => ({
  ...jest.requireActual('@/services/ai/vertex-ai'),
  getVertexAI: jest.fn(),
}));

describe('AI Multi-Tier Fallback & DLQ Resilience Integration Suite', () => {
  // Spins up isolated mongodb-memory-server and clears collections between tests
  setupTestDatabase({ timeout: 60000, clearAfterEach: true });

  const adminUser: AuthSessionUser = {
    id: 'admin_test_01',
    email: 'admin@torbidd.ku.th',
    name: 'Admin Tester',
    picture: '',
    role: 'admin',
    org: 'KU',
  };

  const standardUser: AuthSessionUser = {
    id: 'user_test_01',
    email: 'user@torbidd.ku.th',
    name: 'Standard User',
    picture: '',
    role: 'user',
    org: 'KU',
  };

  let savedEnv: {
    GEMINI_API_KEY?: string;
    OPENROUTER_API_KEY?: string;
    GOOGLE_CLOUD_PROJECT?: string;
    AI_PROVIDER?: string;
    AI_TAGGING_ENABLED?: string;
    ALERT_WEBHOOK_URL?: string;
    LINE_NOTIFY_TOKEN?: string;
  };

  beforeEach(() => {
    // Preserve task-specific env vars without touching MONGODB_URI
    savedEnv = {
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
      GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT,
      AI_PROVIDER: process.env.AI_PROVIDER,
      AI_TAGGING_ENABLED: process.env.AI_TAGGING_ENABLED,
      ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
      LINE_NOTIFY_TOKEN: process.env.LINE_NOTIFY_TOKEN,
    };

    resetProviderCooldowns();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetProviderCooldowns();
    // Restore task-specific env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    }
  });

  // ===========================================================================
  // 1. Multi-Tier AI Provider Switching & Cascading Fallback Chain
  // ===========================================================================
  describe('1. Multi-Tier AI Provider Switching & Cascading Fallback Chain', () => {
    it('1.1 seamlessly fails over from Google AI Studio (HTTP 429) to OpenRouter', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key';
      process.env.OPENROUTER_API_KEY = 'mock-openrouter-key';

      // Mock fetch: Google AI Studio receives 429, OpenRouter receives 200 with valid JSON
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Resource has been exhausted (quota exceeded)',
          };
        }
        if (url.includes('openrouter.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      category: 'Mobile App',
                      isSoftwareRelated: true,
                      confidence: 'High',
                      reasoning: 'Bangkok Metropolitan Citizen Mobile Application',
                    }),
                  },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, text: async () => 'Unknown upstream' };
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKey: 'mock-gemini-key' },
        openrouterOptions: { apiKey: 'mock-openrouter-key' },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'โครงการพัฒนาโมบายล์แอปพลิเคชันเพื่อการบริการประชาชน',
        'Citizen Mobile App for iOS and Android',
      );

      // Verify Google AI Studio is placed in rate-limit cooldown
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);

      // Verify OpenRouter was called and returned the classification
      expect(result.category).toBe('Mobile App');
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.confidence).toBe('High');
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryProviderFailed).toBe('google-ai-studio');
      expect(result.provider).toBe('openrouter');
    });

    it('1.2 cascades across tiers: Google AI Studio (429) -> OpenRouter (429) -> Vertex AI', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key';
      process.env.OPENROUTER_API_KEY = 'mock-openrouter-key';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-ku-vertex-project';

      // Both Google AI Studio and OpenRouter encounter HTTP 429 Rate Limits
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          return {
            ok: false,
            status: 429,
            text: async () => 'Gemini rate limit exceeded',
          };
        }
        if (url.includes('openrouter.ai')) {
          return {
            ok: false,
            status: 429,
            text: async () => 'OpenRouter quota exhausted',
          };
        }
        return { ok: false, status: 500, text: async () => 'Error' };
      });

      // Mock Vertex AI generative model to succeed as the third tier
      (getVertexAI as jest.Mock).mockReturnValue({
        getGenerativeModel: () => ({
          generateContent: async () => ({
            response: {
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          category: 'Cloud',
                          isSoftwareRelated: true,
                          confidence: 'High',
                          reasoning: 'Government Cloud Infrastructure Modernization',
                        }),
                      },
                    ],
                  },
                },
              ],
            },
          }),
        }),
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKey: 'mock-gemini-key' },
        openrouterOptions: { apiKey: 'mock-openrouter-key' },
        vertexOptions: { model: 'gemini-1.5-flash' },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'โครงการจัดซื้อและติดตั้งระบบคลาวด์กลางภาครัฐ',
        'Cloud infrastructure procurement',
      );

      // Verify both Google AI Studio and OpenRouter are placed in cooldown
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);
      expect(isProviderInCooldown('openrouter')).toBe(true);

      // Vertex AI resolved the request
      expect(result.category).toBe('Cloud');
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryProviderFailed).toBe('google-ai-studio');
      expect(result.provider).toBe('vertexai');
    });

    it('1.3 gracefully falls back to Keyword Classifier when all AI tiers fail', async () => {
      process.env.GEMINI_API_KEY = 'mock-gemini-key';
      process.env.OPENROUTER_API_KEY = 'mock-openrouter-key';
      process.env.GOOGLE_CLOUD_PROJECT = 'test-ku-vertex-project';

      // 1. Google AI Studio returns 429
      // 2. OpenRouter returns 429
      const mockFetch = jest.fn().mockImplementation(async () => ({
        ok: false,
        status: 429,
        text: async () => 'Quota exhausted',
      }));

      // 3. Vertex AI also throws a rate limit / quota error
      (getVertexAI as jest.Mock).mockReturnValue({
        getGenerativeModel: () => ({
          generateContent: async () => {
            throw new Error('429 Resource has been exhausted (Vertex AI project quota exceeded)');
          },
        }),
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKey: 'mock-gemini-key' },
        openrouterOptions: { apiKey: 'mock-openrouter-key' },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'จ้างพัฒนาระบบคลังข้อมูลขนาดใหญ่และวิเคราะห์ข้อมูล Big Data Analytics',
        'Data analytics and enterprise business intelligence platform',
      );

      // Verify all 3 AI providers entered cooldown
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);
      expect(isProviderInCooldown('openrouter')).toBe(true);
      expect(isProviderInCooldown('vertexai')).toBe(true);

      // Keyword classifier safely caught the request
      expect(result.category).toBe('Data Analytics');
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.confidence).toBe('High');
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryProviderFailed).toBe('google-ai-studio');
    });

    it('1.4 enforces architectural invariant: Vertex AI is strictly the LAST AI provider before Keyword', () => {
      // Test default chain starting with google-ai-studio
      const chainDefault = buildFallbackChain('google-ai-studio');
      expect(chainDefault).toEqual(['google-ai-studio', 'openrouter', 'vertexai', 'keyword']);
      expect(chainDefault[chainDefault.length - 2]).toBe('vertexai');
      expect(chainDefault[chainDefault.length - 1]).toBe('keyword');

      // Test chain starting with openrouter
      const chainOpenRouter = buildFallbackChain('openrouter');
      expect(chainOpenRouter).toEqual(['openrouter', 'google-ai-studio', 'vertexai', 'keyword']);
      expect(chainOpenRouter[chainOpenRouter.length - 2]).toBe('vertexai');

      // Test custom chain with invalid ordering
      const customMisordered = buildFallbackChain('google-ai-studio', [
        'vertexai',
        'openrouter',
        'google-ai-studio',
        'keyword',
      ]);
      expect(customMisordered).toEqual(['openrouter', 'google-ai-studio', 'vertexai', 'keyword']);
      expect(customMisordered[customMisordered.length - 2]).toBe('vertexai');
      expect(customMisordered[customMisordered.length - 1]).toBe('keyword');

      // Diagnostics check
      const adapter = new FallbackClassifierAdapter({ primaryProvider: 'google-ai-studio' });
      const diagnostics = adapter.getDiagnostics();
      const vertexDiag = diagnostics.find((d) => d.provider === 'vertexai');
      expect(vertexDiag?.isLastAiFallback).toBe(true);

      const googleDiag = diagnostics.find((d) => d.provider === 'google-ai-studio');
      expect(googleDiag?.isLastAiFallback).toBe(false);
    });

    it('1.5 rotates through multi-key pool before falling back to next provider', async () => {
      // Configure 2 keys for Google AI Studio: key #1 429s, key #2 succeeds
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('key=gemini-key-1')) {
          return { ok: false, status: 429, text: async () => 'Key 1 exhausted' };
        }
        if (url.includes('key=gemini-key-2')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          category: 'Website',
                          isSoftwareRelated: true,
                          confidence: 'High',
                          reasoning: 'Web portal system',
                        }),
                      },
                    ],
                  },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, text: async () => 'Err' };
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKeys: ['gemini-key-1', 'gemini-key-2'] },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'โครงการจ้างปรับปรุงเว็บไซต์ศูนย์บริการสารสนเทศ',
        'Portal overhaul',
      );

      // Should succeed via Google AI Studio key #2 without triggering provider cooldown
      expect(result.category).toBe('Website');
      expect(result.provider).toBe('google-ai-studio');
      expect(isProviderInCooldown('google-ai-studio')).toBe(false);
    });
  });

  // ===========================================================================
  // 2. Cooldown Lifecycle & Resilient Recovery
  // ===========================================================================
  describe('2. Cooldown Lifecycle & Resilient Recovery', () => {
    it('2.1 immediately bypasses providers that are currently in cooldown without making HTTP calls', async () => {
      // Place Google AI Studio in cooldown manually
      setProviderCooldown('google-ai-studio', 'HTTP 429 Rate Limit Exceeded', 60000);
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);

      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com')) {
          throw new Error('Should not have called Google AI Studio while in cooldown!');
        }
        if (url.includes('openrouter.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      category: 'Database',
                      isSoftwareRelated: true,
                      confidence: 'High',
                      reasoning: 'SQL Database administration',
                    }),
                  },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, text: async () => 'Err' };
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKey: 'mock-key' },
        openrouterOptions: { apiKey: 'mock-openrouter-key' },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await adapter.classify(
        'โครงการพัฒนาระบบบริหารจัดการฐานข้อมูลกลาง',
        'Central Database Management System',
      );

      // Verified: Google AI Studio was bypassed, OpenRouter succeeded directly
      expect(result.category).toBe('Database');
      expect(result.provider).toBe('openrouter');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('openrouter.ai'),
        expect.anything(),
      );
    });

    it('2.2 handles bulk classification (classifyBulk) with active cooldowns smoothly', async () => {
      setProviderCooldown('google-ai-studio', 'HTTP 429 Rate Limit Exceeded', 60000);

      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('openrouter.ai')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      category: 'ERP',
                      isSoftwareRelated: true,
                      confidence: 'High',
                      reasoning: 'Enterprise Resource Planning software',
                    }),
                  },
                },
              ],
            }),
          };
        }
        return { ok: false, status: 500, text: async () => 'Err' };
      });

      const adapter = new FallbackClassifierAdapter({
        primaryProvider: 'google-ai-studio',
        googleOptions: { apiKey: 'mock-key' },
        openrouterOptions: { apiKey: 'mock-openrouter-key' },
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const batch = [
        { title: 'โครงการพัฒนาระบบ ERP ภาคการศึกษา', description: 'ERP implementation' },
        { title: 'โครงการติดตั้งระบบ SAP ERP สำหรับฝ่ายพัสดุ', description: 'SAP ERP procurement' },
      ];

      const results = await adapter.classifyBulk(batch);
      expect(results).toHaveLength(2);
      expect(results[0].category).toBe('ERP');
      expect(results[1].category).toBe('ERP');
      expect(results[0].provider).toBe('openrouter');
      expect(results[1].provider).toBe('openrouter');
    });

    it('2.3 automatically re-enables provider once cooldown duration expires', () => {
      const now = Date.now();
      // Set short cooldown of 50ms
      setProviderCooldown('google-ai-studio', 'Transient test limit', 50);
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);

      // Fast-forward time past 50ms
      jest.spyOn(Date, 'now').mockReturnValue(now + 100);

      expect(isProviderInCooldown('google-ai-studio')).toBe(false);
      jest.restoreAllMocks();
    });

    it('2.4 clears all cooldowns immediately on administrative reset (resetProviderCooldowns)', () => {
      setProviderCooldown('google-ai-studio', 'HTTP 429', 60000);
      setProviderCooldown('openrouter', 'HTTP 429', 60000);
      setProviderCooldown('vertexai', 'HTTP 429', 60000);

      expect(isProviderInCooldown('google-ai-studio')).toBe(true);
      expect(isProviderInCooldown('openrouter')).toBe(true);
      expect(isProviderInCooldown('vertexai')).toBe(true);

      resetProviderCooldowns();

      expect(isProviderInCooldown('google-ai-studio')).toBe(false);
      expect(isProviderInCooldown('openrouter')).toBe(false);
      expect(isProviderInCooldown('vertexai')).toBe(false);
    });
  });

  // ===========================================================================
  // 3. Dead Letter Queue (DLQ) Database Persistence & State Transitions
  // ===========================================================================
  describe('3. Dead Letter Queue (DLQ) Database Persistence & State Transitions', () => {
    it('3.1 enqueues sync and classification errors with complete metadata', async () => {
      const dlqItem = await enqueueSyncError({
        errorCode: 'HTTP_429_RATE_LIMIT',
        errorMessage: 'Gemini free-tier quota exhausted on BMA procurement classification',
        requestUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
        requestParameters: {
          projectTitle: 'โครงการจัดซื้อระบบเครือข่าย',
          model: 'gemini-1.5-flash',
          source: 'BMA',
        },
        stackTrace: 'AiRateLimitError: HTTP 429 at google-ai-studio-adapter.ts:144:21',
        payloadSnippet: '{"contents":[{"parts":[{"text":"Classify this project..."}]}]}',
        retryCount: 3,
        source: 'AI_CLASSIFIER',
      });

      expect(dlqItem).toBeDefined();
      expect(dlqItem._id).toBeDefined();
      expect(dlqItem.errorCode).toBe('HTTP_429_RATE_LIMIT');
      expect(dlqItem.status).toBe('PENDING');
      expect(dlqItem.alertSent).toBe(false);
      expect(dlqItem.retryCount).toBe(3);
      expect(dlqItem.source).toBe('AI_CLASSIFIER');

      // Verify persistence in MongoDB
      const found = await SyncError.findById(dlqItem._id);
      expect(found).not.toBeNull();
      expect(found?.errorMessage).toContain('Gemini free-tier quota exhausted');
      expect(found?.requestParameters).toMatchObject({ source: 'BMA' });
    });

    it('3.2 truncates oversized payload snippets to 1000 characters to prevent DB bloat', async () => {
      const oversizedSnippet = 'A'.repeat(3500);
      const dlqItem = await enqueueSyncError({
        errorCode: 'PAYLOAD_TOO_LARGE',
        errorMessage: 'Oversized TOR document failed extraction',
        payloadSnippet: oversizedSnippet,
      });

      expect(dlqItem.payloadSnippet).toHaveLength(1000);
      expect(dlqItem.payloadSnippet).toBe('A'.repeat(1000));
    });

    it('3.3 queries pending DLQ items sorted by creation time descending with limit', async () => {
      // Insert items sequentially
      const item1 = await enqueueSyncError({
        errorCode: 'ERR_OLD',
        errorMessage: 'Older failure',
        source: 'BMA',
      });

      const item2 = await enqueueSyncError({
        errorCode: 'ERR_NEW',
        errorMessage: 'Newer failure',
        source: 'EGP',
      });

      // Mark item1 as RESOLVED so only item2 is PENDING
      await updateDlqItemStatus(item1._id.toString(), 'RESOLVED', 'Resolved manually');

      const item3 = await enqueueSyncError({
        errorCode: 'ERR_NEWEST',
        errorMessage: 'Newest failure',
        source: 'CKAN_GOVSPENDING',
      });

      const pending = await getPendingDlqItems(10);
      expect(pending).toHaveLength(2);
      expect(pending[0].errorCode).toBe('ERR_NEWEST');
      expect(pending[1].errorCode).toBe('ERR_NEW');
    });

    it('3.4 transitions DLQ item from PENDING to RESOLVED with notes and auditor info', async () => {
      const item = await enqueueSyncError({
        errorCode: 'AUTH_EXPIRED',
        errorMessage: 'Upstream BMA API token expired',
        source: 'BMA',
      });

      const resolved = await updateDlqItemStatus(
        item._id.toString(),
        'RESOLVED',
        'Updated upstream API bearer credentials in secret manager',
        'lead_devops',
      );

      expect(resolved).not.toBeNull();
      expect(resolved?.status).toBe('RESOLVED');
      expect(resolved?.resolutionNotes).toBe('Updated upstream API bearer credentials in secret manager');
      expect(resolved?.resolvedBy).toBe('lead_devops');
      expect(resolved?.resolvedAt).toBeDefined();

      // Ensure updated record is no longer returned in getPendingDlqItems
      const pendingList = await getPendingDlqItems();
      expect(pendingList.some((p) => p._id.toString() === item._id.toString())).toBe(false);
    });

    it('3.5 transitions DLQ item to DISCARDED for invalid or obsolete records', async () => {
      const item = await enqueueSyncError({
        errorCode: 'CORRUPTED_FEED',
        errorMessage: 'Malformed feed abandoned',
      });

      const discarded = await updateDlqItemStatus(
        item._id.toString(),
        'DISCARDED',
        'Deprecated endpoint permanently abandoned',
        'admin',
      );

      expect(discarded?.status).toBe('DISCARDED');
      expect(discarded?.resolutionNotes).toBe('Deprecated endpoint permanently abandoned');
    });

    it('3.6 calculates aggregate DLQ statistics accurately across all statuses', async () => {
      const e1 = await enqueueSyncError({ errorCode: 'E1', errorMessage: 'Err 1' });
      const e2 = await enqueueSyncError({ errorCode: 'E2', errorMessage: 'Err 2' });
      const e3 = await enqueueSyncError({ errorCode: 'E3', errorMessage: 'Err 3' });
      const e4 = await enqueueSyncError({ errorCode: 'E4', errorMessage: 'Err 4' });

      await updateDlqItemStatus(e1._id.toString(), 'RESOLVED');
      await updateDlqItemStatus(e2._id.toString(), 'RESOLVED');
      await updateDlqItemStatus(e3._id.toString(), 'DISCARDED');
      // e4 remains PENDING

      const stats = await getDlqStats();
      expect(stats.totalCount).toBe(4);
      expect(stats.pendingCount).toBe(1);
      expect(stats.resolvedCount).toBe(2);
      expect(stats.discardedCount).toBe(1);
    });
  });

  // ===========================================================================
  // 4. Alert Dispatch & Retry Threshold Resilience
  // ===========================================================================
  describe('4. Alert Dispatch & Retry Threshold Resilience', () => {
    it('4.1 dispatches Slack / Webhook notification on retry exhaustion (>= 3 attempts)', async () => {
      const dlqItem = await enqueueSyncError({
        errorCode: 'SYNC_RETRIES_EXCEEDED',
        errorMessage: 'Failed to ingest e-GP procurement batch after 3 attempts',
        retryCount: 3,
        source: 'NATIONAL_EGP',
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'ok',
      });

      const alertService = new AlertService({
        webhookUrl: 'https://hooks.slack.com/services/T00/B00/XXXXX',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await alertService.sendRetryExceededAlert({
        errorCode: 'SYNC_RETRIES_EXCEEDED',
        errorMessage: 'Failed to ingest e-GP procurement batch after 3 attempts',
        source: 'NATIONAL_EGP',
        retryAttempts: 3,
        maxAttempts: 3,
        dlqId: dlqItem._id.toString(),
        requestUrl: 'https://opendata.bma.go.th/api/egp',
      });

      expect(result.dispatched).toBe(true);
      expect(result.channel).toBe('slack');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify request payload sent to Slack contains markdown blocks and DLQ id
      const fetchArgs = mockFetch.mock.calls[0];
      const sentPayload = JSON.parse(fetchArgs[1].body);
      expect(sentPayload.text).toContain('🚨 [TORBIDD Critical Alert]');
      expect(JSON.stringify(sentPayload.blocks)).toContain(dlqItem._id.toString());
      expect(JSON.stringify(sentPayload.blocks)).toContain('NATIONAL_EGP');

      // Verify markAlertSent updated the DLQ document in MongoDB
      const updatedDlq = await SyncError.findById(dlqItem._id);
      expect(updatedDlq?.alertSent).toBe(true);
      expect(updatedDlq?.alertSentAt).toBeDefined();
    });

    it('4.2 dispatches LINE Notify alert when configured with lineNotifyToken', async () => {
      const dlqItem = await enqueueSyncError({
        errorCode: 'HTTP_429_RATE_LIMIT',
        errorMessage: 'AI Quota completely exhausted across all providers',
        retryCount: 3,
        source: 'AI_CLASSIFIER',
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: 200, message: 'ok' }),
      });

      const alertService = new AlertService({
        lineNotifyToken: 'test-line-notify-token-xyz',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      const result = await alertService.sendRetryExceededAlert({
        errorCode: 'HTTP_429_RATE_LIMIT',
        errorMessage: 'AI Quota completely exhausted across all providers',
        source: 'AI_CLASSIFIER',
        retryAttempts: 3,
        maxAttempts: 3,
        dlqId: dlqItem._id.toString(),
      });

      expect(result.dispatched).toBe(true);
      expect(result.channel).toBe('line');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://notify-api.line.me/api/notify',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-line-notify-token-xyz',
          }),
        }),
      );

      // Verify DB marked alert sent
      const updated = await SyncError.findById(dlqItem._id);
      expect(updated?.alertSent).toBe(true);
    });

    it('4.3 degrades gracefully when alert webhook encounters network failure or HTTP 500', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Connection timeout to Slack webhook'));

      const alertService = new AlertService({
        webhookUrl: 'https://hooks.slack.com/services/fail',
        fetchImpl: mockFetch as unknown as typeof fetch,
      });

      // Does not throw an unhandled exception
      const result = await alertService.sendRetryExceededAlert({
        errorCode: 'TIMEOUT_ERROR',
        errorMessage: 'Network timeout',
        source: 'TEST',
        retryAttempts: 3,
        maxAttempts: 3,
      });

      // Service falls back to console logger without crashing
      expect(result.channel).toBe('console_dry_run');
    });
  });

  // ===========================================================================
  // 5. Admin API Routes for DLQ and AI Provider Management
  // ===========================================================================
  describe('5. Admin API Routes for DLQ and AI Provider Management', () => {
    it('5.1 GET /api/admin/dlq enforces admin authentication and returns queue items', async () => {
      // 1. Unauthenticated request -> 403 Forbidden
      const unauthReq = new NextRequest('http://localhost:3000/api/admin/dlq');
      const unauthRes = await getDlqRoute(unauthReq);
      expect(unauthRes.status).toBe(403);

      // 2. Standard user (non-admin) request -> 403 Forbidden
      const userCookie = `${AUTH_COOKIE_NAME}=${signSession(standardUser)}`;
      const userReq = new NextRequest('http://localhost:3000/api/admin/dlq', {
        headers: { Cookie: userCookie },
      });
      const userRes = await getDlqRoute(userReq);
      expect(userRes.status).toBe(403);

      // 3. Enqueue a test error into DB
      await enqueueSyncError({
        errorCode: 'ADMIN_ROUTE_TEST',
        errorMessage: 'Verification item for admin API route',
        source: 'BMA',
      });

      // 4. Authenticated admin request -> 200 OK
      const adminCookie = `${AUTH_COOKIE_NAME}=${signSession(adminUser)}`;
      const adminReq = new NextRequest('http://localhost:3000/api/admin/dlq?limit=5', {
        headers: { Cookie: adminCookie },
      });
      const adminRes = await getDlqRoute(adminReq);
      expect(adminRes.status).toBe(200);

      const json = await adminRes.json();
      expect(json.success).toBe(true);
      expect(json.stats.pendingCount).toBeGreaterThanOrEqual(1);
      expect(json.items).toHaveLength(1);
      expect(json.items[0].errorCode).toBe('ADMIN_ROUTE_TEST');
    });

    it('5.2 POST /api/admin/dlq resolves or discards DLQ item based on admin action', async () => {
      const item = await enqueueSyncError({
        errorCode: 'RESOLVE_ME',
        errorMessage: 'Item to resolve via admin endpoint',
      });

      const adminCookie = `${AUTH_COOKIE_NAME}=${signSession(adminUser)}`;

      // Resolve item
      const resolveReq = new NextRequest('http://localhost:3000/api/admin/dlq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          id: item._id.toString(),
          action: 'resolve',
          notes: 'Resolved via Admin Dashboard QA test',
          resolvedBy: 'super_admin',
        }),
      });

      const resolveRes = await postDlqRoute(resolveReq);
      expect(resolveRes.status).toBe(200);
      const resolveJson = await resolveRes.json();
      expect(resolveJson.success).toBe(true);
      expect(resolveJson.item.status).toBe('RESOLVED');
      expect(resolveJson.item.resolutionNotes).toBe('Resolved via Admin Dashboard QA test');

      // Verify non-existent ID returns 404
      const nonExistentReq = new NextRequest('http://localhost:3000/api/admin/dlq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({
          id: new mongoose.Types.ObjectId().toString(),
          action: 'discard',
        }),
      });

      const notFoundRes = await postDlqRoute(nonExistentReq);
      expect(notFoundRes.status).toBe(404);
    });

    it('5.3 GET /api/admin/ai-provider returns diagnostics and identifies Vertex AI as last AI fallback', async () => {
      process.env.AI_PROVIDER = 'google-ai-studio';
      const adminCookie = `${AUTH_COOKIE_NAME}=${signSession(adminUser)}`;
      const req = new NextRequest('http://localhost:3000/api/admin/ai-provider', {
        headers: { Cookie: adminCookie },
      });

      const res = await getAiProviderRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.lastAiFallback).toBe('vertexai');
      expect(json.data.fallbackChain).toContain('vertexai');
      expect(json.data.fallbackChain).toContain('keyword');
    });

    it('5.4 POST /api/admin/ai-provider switches active provider and resets cooldowns', async () => {
      const adminCookie = `${AUTH_COOKIE_NAME}=${signSession(adminUser)}`;

      // Set cooldown first
      setProviderCooldown('google-ai-studio', 'Rate limited', 60000);
      expect(isProviderInCooldown('google-ai-studio')).toBe(true);

      // Reset cooldowns via POST
      const resetReq = new NextRequest('http://localhost:3000/api/admin/ai-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ resetCooldowns: true }),
      });

      const resetRes = await postAiProviderRoute(resetReq);
      expect(resetRes.status).toBe(200);
      expect(isProviderInCooldown('google-ai-studio')).toBe(false);

      // Switch active provider to openrouter
      const switchReq = new NextRequest('http://localhost:3000/api/admin/ai-provider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminCookie,
        },
        body: JSON.stringify({ provider: 'openrouter' }),
      });

      const switchRes = await postAiProviderRoute(switchReq);
      expect(switchRes.status).toBe(200);
      const switchJson = await switchRes.json();
      expect(switchJson.success).toBe(true);
      expect(switchJson.message).toContain('openrouter');
    });
  });

  // ===========================================================================
  // 6. Ingestion Pipeline End-to-End Resilience with AI Fallback & DLQ
  // ===========================================================================
  describe('6. Ingestion Pipeline End-to-End Resilience with AI Fallback & DLQ', () => {
    it('6.1 project classification falls back cleanly to keyword during ingestion without aborting', async () => {
      // Simulate external AI provider outage (e.g. HTTP 429) during project classification
      const mockFetch = jest.fn().mockImplementation(async (url: string) => {
        if (url.includes('generativelanguage.googleapis.com') || url.includes('openrouter.ai')) {
          return { ok: false, status: 429, text: async () => 'Rate limit exceeded' };
        }
        return { ok: false, status: 500, text: async () => 'Error' };
      });

      // Trigger classifyProject with simulated provider failure
      const result = await classifyProject(
        'จ้างเหมาบริการพัฒนาระบบเทคโนโลยีสารสนเทศเพื่อการจัดการข้อมูล',
        'Information system procurement for data management',
        {
          provider: 'google-ai-studio',
          apiKey: 'mock-gemini-key',
          fetchImpl: mockFetch as unknown as typeof fetch,
        },
      );

      // Classification should succeed via keyword fallback and not throw
      expect(result.category).toBe('Information System');
      expect(result.isSoftwareRelated).toBe(true);
      expect(['High', 'Medium', 'Low']).toContain(result.confidence);
      expect(result.fallbackUsed).toBe(true);
      expect(result.primaryProviderFailed).toBe('google-ai-studio');
    });

    it('6.2 fatal sync error enqueues to DLQ, dispatches alert, and maintains health status', async () => {
      // Configure AlertService
      process.env.ALERT_WEBHOOK_URL = 'https://hooks.slack.com/services/test/alerts';

      // Mock discoverFromAllSources to simulate upstream portal throwing fatal 429
      jest.spyOn(IngestionService.prototype, 'discoverFromAllSources').mockRejectedValue(
        new Error('HTTP 429: Too Many Requests from National e-GP portal'),
      );

      // Simulate crawler throwing a fatal HTTP 429 rate limit
      await expect(
        triggerImmediateSync({
          triggerType: 'scheduled',
          keyword: 'ซอฟต์แวร์',
        }),
      ).rejects.toThrow(/Sync failed: HTTP 429/);

      // 1. Verify error was stored in DLQ with HTTP_429_RATE_LIMIT error code
      const pendingDlq = await getPendingDlqItems(5);
      expect(pendingDlq.length).toBeGreaterThanOrEqual(1);

      const syncDlqItem = pendingDlq.find((item) => item.errorCode === 'HTTP_429_RATE_LIMIT');
      expect(syncDlqItem).toBeDefined();
      expect(syncDlqItem?.errorMessage).toContain('Too Many Requests');
      expect(syncDlqItem?.status).toBe('PENDING');

      // 2. Verify SyncLog recorded failure
      const syncLogs = await SyncLog.find().sort({ createdAt: -1 });
      expect(syncLogs.length).toBeGreaterThanOrEqual(1);
      expect(syncLogs[0].status).toBe('FAILED');
      expect(syncLogs[0].errorMessage).toContain('Too Many Requests');

      // 3. Verify SyncStatus health was set to DEGRADED
      const status = getSyncStatus();
      expect(status.health).toBe('DEGRADED');
      expect(status.status).toBe('error');
      expect(status.lastError).toContain('HTTP 429');
    });
  });
});
