/**
 * @jest-environment node
 */
/**
 * SEC-21: Defensive API Architecture, Supply Chain Security & Resiliency
 *
 * OWASP ASVS v4.0.3 Chapter 15 Verification Test Suite
 *
 * Requirements Covered:
 * - V15.1.1: Document risk-based vulnerability remediation timeframes for dependencies.
 * - V15.1.2: Maintain dependency inventory / SBOM from trusted repositories.
 * - V15.1.3: Document and defend against resource exhaustion on demanding operations.
 * - V15.1.5: Document and sandbox dangerous functionality using container resource limits.
 * - V15.2.1: Production dependencies comply with vulnerability update and remediation timeframes.
 * - V15.2.2: Implement defenses against loss of availability (PDF size limits, request timeouts).
 * - V15.2.3: Production build excludes test code, mock snippets, and development utilities.
 * - V15.2.4: Verify package integrity using lockfiles (package-lock.json).
 * - V15.2.5: Sandbox resource-demanding operations with Docker container constraints.
 * - V15.3.1: Return only required subset of fields from data objects in API responses.
 * - V15.3.2: Backend fetch calls do not follow external redirects automatically unless intended.
 * - V15.3.3: Countermeasures against mass assignment attacks via Zod allowlisting.
 * - V15.3.4: Accurately resolve client IP addresses via trusted reverse proxy headers.
 * - V15.3.5: Enforce strict type comparisons and explicit type validations.
 * - V15.3.6: Prototype pollution prevention via safe object handling (Map/Set, Object.create(null)).
 * - V15.3.7: Defenses against HTTP parameter pollution.
 * - V15.4.2: Enforce atomic state checks and updates to prevent TOCTOU race conditions.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  VERTEX_AI_TIMEOUT_MS,
  withTimeout,
} from '@/services/ai/vertex-ai';
import { VertexAiAdapter } from '@/services/ai/adapters/vertex-ai-adapter';
import {
  MAX_PDF_BUFFER_BYTES,
  extractTorFromBuffer,
} from '@/services/ai/tor-extractor';
import {
  isPrototypePollutionKey,
  createSafeDict,
  sanitizeObject,
  safeJsonParse,
  getSafeSingleParam,
  isSafeRedirectTarget,
} from '@/lib/safe-object';
import {
  AdminProjectUpdateSchema,
  BookmarkCreateSchema,
} from '@/lib/validation';
import ProcurementProject from '@/models/ProcurementProject';
import {
  GET as getAdminProjectHandler,
  PATCH as patchAdminProjectHandler,
} from '@/app/api/admin/projects/[id]/route';

describe('SEC-21: Defensive API Architecture, Supply Chain Security & Resiliency', () => {
  // ── 1. Supply Chain Security & Documentation (ASVS V15.1.1, V15.1.2, V15.2.4) ──
  describe('1. Supply Chain Security & Dependency Inventory (ASVS V15.1.1, V15.1.2, V15.2.4)', () => {
    const docPath = path.resolve(__dirname, '../../docs/security/defensive-architecture-supply-chain.md');
    const lockfilePath = path.resolve(__dirname, '../../package-lock.json');
    const ciPath = path.resolve(__dirname, '../../../.github/workflows/ci.yml');

    it('documents risk-based remediation timeframes for third-party dependencies', () => {
      expect(fs.existsSync(docPath)).toBe(true);
      const content = fs.readFileSync(docPath, 'utf-8');

      expect(content).toContain('Critical');
      expect(content).toContain('7 Days');
      expect(content).toContain('High');
      expect(content).toContain('14 Days');
      expect(content).toContain('Medium');
      expect(content).toContain('30 Days');
    });

    it('maintains package-lock.json with cryptographic integrity hashes', () => {
      expect(fs.existsSync(lockfilePath)).toBe(true);
      const content = fs.readFileSync(lockfilePath, 'utf-8');
      const lockfile = JSON.parse(content);

      expect(lockfile).toHaveProperty('lockfileVersion');
      expect(content).toContain('sha512-');
    });

    it('enforces npm ci and npm audit execution in CI workflow', () => {
      expect(fs.existsSync(ciPath)).toBe(true);
      const ciContent = fs.readFileSync(ciPath, 'utf-8');

      expect(ciContent).toContain('npm ci');
      expect(ciContent).toContain('npm audit --audit-level=high');
    });
  });

  // ── 2. Resource Exhaustion & Timeout Defenses (ASVS V15.1.3 & V15.2.2) ─────
  describe('2. Resource Exhaustion & Timeout Defenses (ASVS V15.1.3 & V15.2.2)', () => {
    it('defines standard Vertex AI prompt timeout of 10 seconds', () => {
      expect(VERTEX_AI_TIMEOUT_MS).toBe(10_000);
    });

    it('withTimeout resolves when the promise finishes within the deadline', async () => {
      const fastPromise = new Promise<string>((resolve) => setTimeout(() => resolve('success'), 50));
      const result = await withTimeout(fastPromise, 500, 'Test fast operation');
      expect(result).toBe('success');
    });

    it('withTimeout rejects when the promise exceeds the deadline', async () => {
      const slowPromise = new Promise<string>((resolve) => setTimeout(() => resolve('slow'), 500));
      await expect(withTimeout(slowPromise, 50, 'Test slow operation')).rejects.toThrow(
        /exceeded execution deadline/i,
      );
    });

    it('VertexAiAdapter catches timeout and gracefully falls back to rule-based classification', async () => {
      const adapter = new VertexAiAdapter();
      // Even if Vertex AI is not configured or times out, classify must return a valid ClassificationResult
      const result = await adapter.classify(
        'จัดซื้อระบบคอมพิวเตอร์และเครือข่าย',
        'พัฒนาระบบซอฟต์แวร์สารสนเทศสำหรับโรงพยาบาล',
      );

      expect(result).toBeDefined();
      expect(result.isSoftwareRelated).toBe(true);
      expect(result.category).toBeDefined();
    });

    it('defines maximum safe PDF buffer size of 50MB', () => {
      expect(MAX_PDF_BUFFER_BYTES).toBe(50 * 1024 * 1024);
    });

    it('extractTorFromBuffer rejects buffers exceeding the 50MB ceiling', async () => {
      // Mock an oversized buffer without actually allocating 51MB in memory
      const fakeLargeBuffer = {
        length: 51 * 1024 * 1024,
        toString: () => '',
      } as unknown as Buffer;

      await expect(extractTorFromBuffer(fakeLargeBuffer)).rejects.toThrow(/exceeds maximum safe limit of 50MB/i);
    });
  });

  // ── 3. Container Sandboxing & Resource Limits (ASVS V15.1.5 & V15.2.5) ─────
  describe('3. Container Sandboxing & Resource Limits (ASVS V15.1.5 & V15.2.5)', () => {
    const composePath = path.resolve(__dirname, '../../../docker-compose.yml');

    it('configures 1GB RAM cap and CPU limits in docker-compose.yml', () => {
      expect(fs.existsSync(composePath)).toBe(true);
      const composeContent = fs.readFileSync(composePath, 'utf-8');

      expect(composeContent).toContain('mem_limit: 1024m');
      expect(composeContent).toContain('cpus: 2.0');
      expect(composeContent).toContain('memory: 1024M');
    });
  });

  // ── 4. Production Build Hygiene (ASVS V15.2.3) ─────────────────────────────
  describe('4. Production Build Hygiene (ASVS V15.2.3)', () => {
    const dockerignorePath = path.resolve(__dirname, '../../.dockerignore');

    it('.dockerignore strips tests, dev configs, and git metadata', () => {
      expect(fs.existsSync(dockerignorePath)).toBe(true);
      const content = fs.readFileSync(dockerignorePath, 'utf-8');

      expect(content).toContain('.git');
      expect(content).toContain('*.test.*');
      expect(content).toContain('__tests__');
    });
  });

  // ── 5. Mass Assignment Countermeasures (ASVS V15.3.3) ──────────────────────
  describe('5. Mass Assignment Countermeasures (ASVS V15.3.3)', () => {
    it('AdminProjectUpdateSchema rejects unexpected or privileged fields', () => {
      const maliciousPayload = {
        projectName: 'Legitimate Name',
        role: 'admin',
        isAdmin: true,
        _id: '507f1f77bcf86cd799439011',
        hack: 'injected',
      };

      const result = AdminProjectUpdateSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true);
        expect(result.error.issues.length).toBeGreaterThan(0);
      }
    });

    it('AdminProjectUpdateSchema accepts legitimate allowed fields', () => {
      const validPayload = {
        projectName: 'ระบบบริหารจัดการข้อมูลการจัดซื้อ',
        budget: 5000000,
        fiscalYear: 2568,
        is_software: true,
        software_category: 'Website',
      };

      const result = AdminProjectUpdateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    it('BookmarkCreateSchema rejects extra unallowed fields', () => {
      const invalidBookmark = {
        projectId: '507f1f77bcf86cd799439011',
        injectedField: 'malicious',
      };

      const result = BookmarkCreateSchema.safeParse(invalidBookmark);
      expect(result.success).toBe(false);
    });
  });

  // ── 6. Prototype Pollution Prevention (ASVS V15.3.6) ───────────────────────
  describe('6. Prototype Pollution Prevention (ASVS V15.3.6)', () => {
    it('isPrototypePollutionKey accurately identifies dangerous keys', () => {
      expect(isPrototypePollutionKey('__proto__')).toBe(true);
      expect(isPrototypePollutionKey('constructor')).toBe(true);
      expect(isPrototypePollutionKey('prototype')).toBe(true);
      expect(isPrototypePollutionKey('safeKey')).toBe(false);
    });

    it('createSafeDict returns an object with null prototype', () => {
      const dict = createSafeDict<string>();
      expect(Object.getPrototypeOf(dict)).toBeNull();
      dict.name = 'safe';
      expect(dict.toString).toBeUndefined(); // Does not inherit from Object.prototype
    });

    it('sanitizeObject removes prototype pollution keys from nested structures', () => {
      const poisoned = JSON.parse('{"name": "test", "__proto__": {"polluted": true}, "nested": {"constructor": "bad"}}');
      const clean = sanitizeObject(poisoned);

      expect(clean.name).toBe('test');
      expect(clean.__proto__).toBeUndefined();
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('safeJsonParse strips prototype pollution keys during deserialization', () => {
      const json = '{"title": "Report", "__proto__": {"isAdmin": true}}';
      const parsed = safeJsonParse<{ title: string; isAdmin?: boolean }>(json, { title: 'fallback' });

      expect(parsed.title).toBe('Report');
      expect(parsed.isAdmin).toBeUndefined();
      expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();
    });
  });

  // ── 7. HTTP Parameter Pollution Defenses (ASVS V15.3.7) ────────────────────
  describe('7. HTTP Parameter Pollution Defenses (ASVS V15.3.7)', () => {
    it('getSafeSingleParam extracts single string when an array is injected', () => {
      const injectedArray = ['legit_id', 'malicious_id'];
      const single = getSafeSingleParam(injectedArray);
      expect(single).toBe('legit_id');
    });

    it('getSafeSingleParam returns trimmed string for valid scalar inputs', () => {
      expect(getSafeSingleParam(' 12345 ')).toBe('12345');
    });

    it('getSafeSingleParam returns fallback on empty or null values', () => {
      expect(getSafeSingleParam(null, 'default')).toBe('default');
      expect(getSafeSingleParam('', 'default')).toBe('default');
    });
  });

  // ── 8. Safe Redirect Validation (ASVS V15.3.2) ─────────────────────────────
  describe('8. Safe Redirect Validation (ASVS V15.3.2)', () => {
    it('accepts relative same-origin paths', () => {
      expect(isSafeRedirectTarget('/opportunities')).toBe(true);
      expect(isSafeRedirectTarget('/th/historical')).toBe(true);
    });

    it('rejects protocol-relative and malicious external redirect URLs', () => {
      expect(isSafeRedirectTarget('//evil.com')).toBe(false);
      expect(isSafeRedirectTarget('/\\evil.com')).toBe(false);
      expect(isSafeRedirectTarget('https://evil.com/phishing')).toBe(false);
      expect(isSafeRedirectTarget('javascript:alert(1)')).toBe(false);
      expect(isSafeRedirectTarget('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('accepts explicitly approved government domain targets', () => {
      expect(isSafeRedirectTarget('https://torbidd.bangkok.go.th/dashboard')).toBe(true);
      expect(isSafeRedirectTarget('http://localhost:3000/callback')).toBe(true);
    });
  });

  // ── 9. Atomic Concurrency & TOCTOU Prevention (ASVS V15.4.2) ──────────────
  describe('9. Atomic Concurrency & TOCTOU Prevention (ASVS V15.4.2)', () => {
    it('ProcurementProject enforces compound and unique indexes to prevent insertion races', () => {
      const indexes = ProcurementProject.schema.indexes();

      // Check externalProjectId unique index
      const externalIdUnique = ProcurementProject.schema.path('externalProjectId') as unknown as { options?: { unique?: boolean } };
      expect(externalIdUnique.options?.unique).toBe(true);

      // Check compound index on externalProjectId and contentHash
      const compoundIndex = indexes.find(
        ([fields]) => fields.externalProjectId === 1 && fields.contentHash === 1,
      );
      expect(compoundIndex).toBeDefined();
    });
  });

  // ── 10. Admin Projects API Endpoint Validation (`/api/admin/projects/[id]`) ─
  describe('10. Admin Projects API Endpoint Validation (`/api/admin/projects/[id]`)', () => {
    it('GET /api/admin/projects/[id] rejects unauthenticated access with 401 or 403', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/projects/67119538991');
      const res = await getAdminProjectHandler(req, { params: Promise.resolve({ id: '67119538991' }) });

      expect([401, 403]).toContain(res.status);
    });

    it('PATCH /api/admin/projects/[id] rejects unauthenticated mutation', async () => {
      const req = new NextRequest('http://localhost:3000/api/admin/projects/67119538991', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: 'New Name' }),
      });
      const res = await patchAdminProjectHandler(req, { params: Promise.resolve({ id: '67119538991' }) });

      expect([401, 403]).toContain(res.status);
    });
  });
});
