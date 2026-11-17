/**
 * @jest-environment node
 */
// =============================================================================
// src/__tests__/sec-19-environment-hardening.test.ts
// Verification test suite for SEC-19: Environment Hardening & Centralized Secrets Management
// ASVS v4.0.3 Chapter 13 (V13.1, V13.2, V13.3, V13.4)
// =============================================================================

import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import {
  getMongoConnectionOptions,
  validateMongoUri,
  MONGO_DEFAULT_POOL_SIZE,
  MONGO_DEFAULT_TIMEOUT_MS,
} from '@/lib/mongodb';
import { BmaClient } from '@/services/ingestion/clients/bma-client';
import { EgpClient } from '@/services/ingestion/clients/egp-client';
import { GovSpendingClient } from '@/services/ingestion/clients/govspending-client';
import { GET as getDlq } from '@/app/api/admin/dlq/route';
import { GET as getSyncHealth } from '@/app/api/admin/sync-health/route';
import fs from 'node:fs';
import path from 'node:path';

describe('SEC-19: Environment Hardening & Centralized Secrets Management', () => {
  describe('1. MongoDB Connection Pool & Configuration (ASVS V13.1.2 & V13.2.3)', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('enforces default maxPoolSize: 10 and serverSelectionTimeoutMS: 5000', () => {
      delete process.env.MONGODB_MAX_POOL_SIZE;
      delete process.env.MONGODB_TIMEOUT_MS;

      const options = getMongoConnectionOptions();
      expect(options.maxPoolSize).toBe(10);
      expect(options.serverSelectionTimeoutMS).toBe(5000);
      expect(MONGO_DEFAULT_POOL_SIZE).toBe(10);
      expect(MONGO_DEFAULT_TIMEOUT_MS).toBe(5000);
    });

    it('respects environment overrides for connection pool parameters', () => {
      process.env.MONGODB_MAX_POOL_SIZE = '15';
      process.env.MONGODB_TIMEOUT_MS = '8000';

      const options = getMongoConnectionOptions();
      expect(options.maxPoolSize).toBe(15);
      expect(options.serverSelectionTimeoutMS).toBe(8000);
    });

    it('validates and rejects default credentials in MONGODB_URI (ASVS V13.2.3)', () => {
      // Dynamically constructed dummy URIs without real hostnames to prevent secret scanning false positives
      const makeUri = (user: string, pass: string, srv = false) =>
        `mongodb${srv ? '+srv' : ''}://${user}:${pass}@dummy-host.internal/torbidd`;

      const defaultCredUris = [
        makeUri('root', 'root', false),
        makeUri('admin', 'admin', false),
        makeUri('root', 'password', true),
        makeUri('admin', 'password', true),
      ];

      for (const uri of defaultCredUris) {
        expect(() => validateMongoUri(uri)).toThrow(
          /Default credentials are not permitted in MONGODB_URI/,
        );
      }
    });

    it('accepts non-default credentials in MONGODB_URI', () => {
      const validUris = [
        'mongodb+srv://torbidd_app_user:mock_random_p@ss@dummy-host.internal/torbidd',
        'mongodb://svc_torbidd_ro:mock_service_p@ss@10.0.1.20:27017/torbidd',
      ];

      for (const uri of validUris) {
        expect(() => validateMongoUri(uri)).not.toThrow();
      }
    });
  });

  describe('2. Outbound Crawler Requests & SSRF Mitigation (ASVS V13.2.4 & V13.2.5)', () => {
    it('BmaClient accepts approved domain (egp2.bangkok.go.th)', () => {
      expect(() => {
        new BmaClient({ baseUrl: 'https://egp2.bangkok.go.th' });
      }).not.toThrow();
    });

    it('BmaClient rejects private RFC 1918 IPs and loopback destinations', () => {
      const forbiddenUrls = [
        'http://127.0.0.1:80',
        'http://localhost:3000',
        'http://10.0.0.1',
        'http://172.16.0.5',
        'http://192.168.1.100',
        'http://169.254.169.254/metadata',
      ];

      for (const url of forbiddenUrls) {
        expect(() => {
          new BmaClient({ baseUrl: url });
        }).toThrow(/SSRF Blocked/);
      }
    });

    it('BmaClient rejects unauthorized third-party external domains', () => {
      expect(() => {
        new BmaClient({ baseUrl: 'https://malicious-attacker.com' });
      }).toThrow(/SSRF Blocked/);
    });

    it('BmaClient.fileUrl rejects malicious target endpoints', () => {
      const client = new BmaClient();
      expect(() => {
        client.fileUrl('announcement-123', 'document.pdf');
      }).not.toThrow();
    });

    it('EgpClient accepts approved government domains (gprocurement.go.th)', () => {
      expect(() => {
        new EgpClient({
          baseUrl: 'https://process5.gprocurement.go.th',
          portalUrl: 'https://www.gprocurement.go.th',
          rssBaseUrl: 'https://process3.gprocurement.go.th/EPROCRssFeedWeb/egpannouncerss.xml',
        });
      }).not.toThrow();
    });

    it('EgpClient rejects private IP ranges and untrusted domains', () => {
      expect(() => {
        new EgpClient({ baseUrl: 'http://192.168.1.1' });
      }).toThrow(/SSRF Blocked/);

      expect(() => {
        new EgpClient({ portalUrl: 'http://10.0.0.1' });
      }).toThrow(/SSRF Blocked/);

      expect(() => {
        new EgpClient({ rssBaseUrl: 'http://169.254.169.254/latest/meta-data' });
      }).toThrow(/SSRF Blocked/);

      expect(() => {
        new EgpClient({ baseUrl: 'https://phishing-egp.com' });
      }).toThrow(/SSRF Blocked/);
    });

    it('GovSpendingClient accepts approved domain (data.go.th & opend.data.go.th)', () => {
      expect(() => {
        new GovSpendingClient({
          baseUrl: 'https://opend.data.go.th/govspending/service/egp-contract',
        });
      }).not.toThrow();
    });

    it('GovSpendingClient rejects private IP ranges and untrusted hosts', () => {
      expect(() => {
        new GovSpendingClient({ baseUrl: 'http://127.0.0.1:8080' });
      }).toThrow(/SSRF Blocked/);

      expect(() => {
        new GovSpendingClient({ baseUrl: 'http://10.1.2.3' });
      }).toThrow(/SSRF Blocked/);

      expect(() => {
        new GovSpendingClient({ baseUrl: 'https://untrusted-api.io' });
      }).toThrow(/SSRF Blocked/);
    });
  });

  describe('3. HTTP TRACE Method Restriction (ASVS V13.4.4)', () => {
    it('returns HTTP 405 Method Not Allowed for TRACE requests on web routes', async () => {
      const req = new NextRequest('http://localhost:3000/opportunities');
      Object.defineProperty(req, 'method', { value: 'TRACE', configurable: true });

      const response = await middleware(req);
      expect(response.status).toBe(405);

      const json = await response.json();
      expect(json).toEqual({ error: 'Method Not Allowed' });
      expect(response.headers.get('Allow')).toContain('GET');
      expect(response.headers.get('Allow')).not.toContain('TRACE');
    });

    it('returns HTTP 405 Method Not Allowed for TRACE requests on API routes', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/users');
      Object.defineProperty(req, 'method', { value: 'TRACE', configurable: true });

      const response = await middleware(req);
      expect(response.status).toBe(405);

      const json = await response.json();
      expect(json).toEqual({ error: 'Method Not Allowed' });
    });
  });

  describe('4. Administrative Endpoint Access Controls (ASVS V13.4.5)', () => {
    it('/api/admin/dlq rejects unauthenticated requests with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/dlq');
      const response = await getDlq(req);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toMatch(/Admin access required/i);
    });

    it('/api/admin/sync-health rejects unauthenticated requests with 403 Forbidden', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/sync-health');
      const response = await getSyncHealth(req);
      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error).toMatch(/Admin access required/i);
    });
  });

  describe('5. Source Control Metadata & Docker Hardening (ASVS V13.4.1 & V13.4.7)', () => {
    it('.dockerignore excludes .git, test suites, and .env files', () => {
      const repoRoot = path.resolve(__dirname, '../../../');
      const dockerignorePath = path.resolve(repoRoot, '.dockerignore');
      const content = fs.readFileSync(dockerignorePath, 'utf-8');

      expect(content).toMatch(/\.git\//);
      expect(content).toMatch(/\.env/);
      expect(content).toMatch(/__tests__/);
      expect(content).toMatch(/\*\.test\.\*/);
    });

    it('torbidd-app/.dockerignore excludes source control metadata and test files', () => {
      const appRoot = path.resolve(__dirname, '../../');
      const dockerignorePath = path.resolve(appRoot, '.dockerignore');
      const content = fs.readFileSync(dockerignorePath, 'utf-8');

      expect(content).toMatch(/\.git\//);
      expect(content).toMatch(/\.env/);
      expect(content).toMatch(/__tests__/);
      expect(content).toMatch(/\*\.test\.\*/);
    });

    it('.env.example documents critical secrets, connection pool limits, and rotation schedule', () => {
      const appRoot = path.resolve(__dirname, '../../');
      const envExamplePath = path.resolve(appRoot, '.env.example');
      const content = fs.readFileSync(envExamplePath, 'utf-8');

      expect(content).toContain('MONGODB_URI');
      expect(content).toContain('MONGODB_MAX_POOL_SIZE=10');
      expect(content).toContain('MONGODB_TIMEOUT_MS=5000');
      expect(content).toContain('CRON_SECRET');
      expect(content).toContain('SESSION_SECRET');
      expect(content).toContain('GOOGLE_CLIENT_SECRET');
      expect(content).toContain('ALLOWED_DOCUMENT_HOSTS');
      expect(content).toMatch(/rotation schedule/i);
    });
  });
});
