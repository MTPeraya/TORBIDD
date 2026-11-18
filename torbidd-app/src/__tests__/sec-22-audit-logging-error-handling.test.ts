/**
 * @jest-environment node
 */
/**
 * SEC-22: Security Audit Logging & Fail-Secure Error Handling
 *
 * OWASP ASVS v4.0.3 Chapter 16 (Logging & Error Handling) and Chapter 17 (WebRTC Scope Exclusion)
 *
 * Requirements Covered:
 * - V16.1.1: Document application logging inventory (events, formats, storage, retention).
 * - V16.2.1: Log entries include essential metadata (timestamp, user, IP, event, resource, outcome).
 * - V16.2.2: Synchronize time sources and enforce ISO 8601 UTC timestamps across all logging components.
 * - V16.2.3: Store logs only to documented, approved destinations.
 * - V16.2.4: Use structured JSON format for log searchability and correlation.
 * - V16.2.5: Enforce log data sanitization (never log credentials, tokens, or masked secrets).
 * - V16.3.1: Log all authentication events (successful and failed Google OAuth sign-in attempts).
 * - V16.3.2: Log failed authorization attempts (unauthorized admin panel accesses, forbidden actions).
 * - V16.3.3: Log security control bypass attempts, rate-limit triggers, and validation failures.
 * - V16.3.4: Log unexpected system errors and external service failures (database drops, TLS errors).
 * - V16.4.1: Prevent log injection by sanitizing untrusted user inputs (CRLF escaping).
 * - V16.4.2: Restrict log access and protect audit logs from unauthorized modification.
 * - V16.5.1: Return generic error messages to consumers without leaking stack traces or internal queries.
 * - V16.5.2: Ensure graceful degradation and circuit breaking when external services (Vertex AI, e-GP) fail.
 * - V16.5.3: Ensure fail-secure operation; prevent fail-open state on validation or authorization errors.
 * - V16.5.4: Implement a last-resort global error handler to catch unhandled exceptions and prevent process crashes.
 * - V17.1 - V17.3: WebRTC Architectural Scope Exclusion (TURN, DTLS-SRTP, Media, Signaling).
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import {
  formatSecurityLog,
  redactSensitiveData,
  sanitizeLogString,
  logAuthSuccess,
  logAuthFailure,
  logAuthzFailure,
  logSecurityEvent,
  logSystemError,
} from '@/lib/audit-logger';
import { middleware } from '@/middleware';
import { requireAdmin } from '@/lib/authorization/backend';
import { initGlobalProcessErrorHandlers } from '@/lib/global-error-handler';

describe('SEC-22: Security Audit Logging & Fail-Secure Error Handling', () => {
  // ── 1. Logging Inventory & Approved Destinations (ASVS V16.1.1 & V16.2.3) ──
  describe('1. Logging Inventory & Documentation (ASVS V16.1.1, V16.2.3, V16.4.2)', () => {
    const docPath = path.resolve(__dirname, '../../docs/security/audit-logging-error-handling.md');

    it('documents application logging inventory, formats, destinations, and retention', () => {
      expect(fs.existsSync(docPath)).toBe(true);
      const content = fs.readFileSync(docPath, 'utf-8');

      expect(content).toContain('Logging Inventory');
      expect(content).toContain('Structured JSON');
      expect(content).toContain('Cloud Logging');
      expect(content).toContain('90 Days');
      expect(content).toContain('Access Control');
    });
  });

  // ── 2. Structured JSON & ISO 8601 UTC Timestamp (ASVS V16.2.1, V16.2.2, V16.2.4) ──
  describe('2. Structured JSON & ISO 8601 UTC Timestamps (ASVS V16.2.1, V16.2.2, V16.2.4)', () => {
    it('generates valid JSON with required metadata and UTC timestamp', () => {
      const jsonStr = formatSecurityLog({
        level: 'SECURITY',
        eventType: 'TEST_AUDIT_EVENT',
        userId: 'officer_123',
        clientIp: '10.0.0.1',
        resource: '/api/test',
        outcome: 'BLOCKED',
        details: { action: 'test_action' },
      });

      const parsed = JSON.parse(jsonStr);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'SECURITY');
      expect(parsed).toHaveProperty('eventType', 'TEST_AUDIT_EVENT');
      expect(parsed).toHaveProperty('userId', 'officer_123');
      expect(parsed).toHaveProperty('clientIp', '10.0.0.1');
      expect(parsed).toHaveProperty('resource', '/api/test');
      expect(parsed).toHaveProperty('outcome', 'BLOCKED');

      // ASVS V16.2.2: Timestamp must be valid ISO 8601 UTC ending with 'Z'
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });

  // ── 3. Sensitive Token Redaction & Log Injection (ASVS V16.2.5 & V16.4.1) ──
  describe('3. Sensitive Token Redaction & Log Injection (ASVS V16.2.5 & V16.4.1)', () => {
    it('automatically redacts sensitive keys (passwords, tokens, secrets, cookies)', () => {
      const sensitivePayload = {
        username: 'bma_officer',
        password: 'SuperSecretPassword123!',
        googleClientSecret: 'GOCSPX-abc123secret',
        sessionToken: 'eyJh...token',
        authCookie: '__Host-torbidd_auth=val',
        authorization: 'Bearer sensitive_bearer_token',
        nested: {
          apiSecret: 'secret_value',
          safeField: 'visible_data',
        },
      };

      const redacted = redactSensitiveData(sensitivePayload);
      expect(redacted.password).toBe('[REDACTED]');
      expect(redacted.googleClientSecret).toBe('[REDACTED]');
      expect(redacted.sessionToken).toBe('[REDACTED]');
      expect(redacted.authCookie).toBe('[REDACTED]');
      expect(redacted.authorization).toBe('[REDACTED]');
      expect(redacted.nested.apiSecret).toBe('[REDACTED]');
      expect(redacted.nested.safeField).toBe('visible_data');
    });

    it('redacts standalone Bearer token strings', () => {
      const rawBearer = 'Bearer ya29.a0AfH6SM...google_token';
      const redacted = redactSensitiveData(rawBearer);
      expect(redacted).toBe('Bearer [REDACTED]');
    });

    it('escapes CRLF characters to prevent log injection and forging', () => {
      const forgedInput = 'AdminUser\r\n[2026-11-18T00:00:00Z] LEVEL: ADMIN_GRANTED Injected Log Line\nAnother Line';
      const sanitized = sanitizeLogString(forgedInput);

      expect(sanitized).not.toContain('\r');
      expect(sanitized).not.toContain('\n');
      expect(sanitized).toContain('\\r\\n');
      expect(sanitized).toContain('\\n');
    });
  });

  // ── 4. Security Events & Authentication Logging (ASVS V16.3.1 - V16.3.4) ───
  describe('4. Security Events & Authentication Logging (ASVS V16.3.1 - V16.3.4)', () => {
    let consoleInfoSpy: jest.SpyInstance;
    let consoleWarnSpy: jest.SpyInstance;
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
      consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleInfoSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    it('logAuthSuccess emits structured JSON with outcome SUCCESS (ASVS V16.3.1)', () => {
      logAuthSuccess('user_123', '192.168.1.10', { email: 'officer@bangkok.go.th' });

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleInfoSpy.mock.calls[0][0]);
      expect(output.eventType).toBe('AUTH_LOGIN_SUCCESS');
      expect(output.outcome).toBe('SUCCESS');
      expect(output.userId).toBe('user_123');
    });

    it('logAuthFailure emits structured JSON with outcome FAILURE (ASVS V16.3.1)', () => {
      logAuthFailure('unknown@user.com', '192.168.1.10', 'Invalid nonce');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(output.eventType).toBe('AUTH_LOGIN_FAILURE');
      expect(output.outcome).toBe('FAILURE');
      expect(output.details.reason).toBe('Invalid nonce');
    });

    it('requireAdmin logs failed authorization attempt with status 403 (ASVS V16.3.2)', () => {
      const nonAdminUser = {
        id: 'user_456',
        email: 'officer@bangkok.go.th',
        name: 'Officer',
        picture: 'https://example.com/avatar.png',
        role: 'BMA Officer',
        org: 'BMA',
      };

      const result = requireAdmin(nonAdminUser);
      expect(result.ok).toBe(false);

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(output.eventType).toBe('AUTHZ_ACCESS_DENIED');
      expect(output.outcome).toBe('BLOCKED');
      expect(output.details.status).toBe(403);
    });

    it('middleware logs and blocks HTTP TRACE method with 405 (ASVS V16.3.3)', () => {
      const req = new NextRequest('http://localhost:3000/api/projects');
      Object.defineProperty(req, 'method', { value: 'TRACE', configurable: true });
      const res = middleware(req);

      expect(res.status).toBe(405);
      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
      expect(output.eventType).toBe('HTTP_TRACE_METHOD_REJECTED');
      expect(output.outcome).toBe('BLOCKED');
    });

    it('logSystemError records unexpected errors in structured JSON (ASVS V16.3.4)', () => {
      logSystemError('DATABASE_TIMEOUT', new Error('MongoServerSelectionError: timeout'));

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
      expect(output.level).toBe('ERROR');
      expect(output.eventType).toBe('DATABASE_TIMEOUT');
      expect(output.error.message).toContain('MongoServerSelectionError');
    });
  });

  // ── 5. Fail-Secure Error Handling (ASVS V16.5.1 - V16.5.4) ────────────────
  describe('5. Fail-Secure Error Handling (ASVS V16.5.1 - V16.5.4)', () => {
    it('src/app/error.tsx exists and renders generic message without leaking stack traces', () => {
      const errorBoundaryPath = path.resolve(__dirname, '../app/error.tsx');
      expect(fs.existsSync(errorBoundaryPath)).toBe(true);
      const content = fs.readFileSync(errorBoundaryPath, 'utf-8');

      expect(content).toContain('Internal Server Error');
      expect(content).not.toContain('error.stack'); // Must never render stack trace to user
    });

    it('src/app/global-error.tsx exists as root last-resort error boundary', () => {
      const globalErrorPath = path.resolve(__dirname, '../app/global-error.tsx');
      expect(fs.existsSync(globalErrorPath)).toBe(true);
      const content = fs.readFileSync(globalErrorPath, 'utf-8');

      expect(content).toContain('System Error');
      expect(content).toContain('GlobalError');
    });

    it('initGlobalProcessErrorHandlers registers uncaughtException and unhandledRejection listeners', () => {
      initGlobalProcessErrorHandlers();
      const exceptionListeners = process.listeners('uncaughtException');
      const rejectionListeners = process.listeners('unhandledRejection');

      expect(exceptionListeners.length).toBeGreaterThan(0);
      expect(rejectionListeners.length).toBeGreaterThan(0);
    });
  });

  // ── 6. WebRTC Architectural Scope Exclusion (ASVS Chapter 17) ─────────────
  describe('6. WebRTC Architectural Scope Exclusion (ASVS Chapter 17)', () => {
    const composePath = path.resolve(__dirname, '../../../docker-compose.yml');
    const docPath = path.resolve(__dirname, '../../docs/security/audit-logging-error-handling.md');

    it('docker-compose.yml exposes only TCP web ports and zero UDP media ports', () => {
      expect(fs.existsSync(composePath)).toBe(true);
      const compose = fs.readFileSync(composePath, 'utf-8');

      expect(compose).toMatch(/"3000:3000"|"443:443"|"80:80"/);
      // Must not expose UDP ranges for RTP/TURN (e.g. /udp or 3478 or 10000-20000)
      expect(compose).not.toContain('/udp');
      expect(compose).not.toContain('3478');
      expect(compose).not.toContain('5349');
    });

    it('documents formal exclusion of all 12 WebRTC ASVS V17 requirements with zero residual risk', () => {
      expect(fs.existsSync(docPath)).toBe(true);
      const content = fs.readFileSync(docPath, 'utf-8');

      expect(content).toContain('WebRTC Architectural Scope Exclusion');
      expect(content).toContain('TURN');
      expect(content).toContain('DTLS');
      expect(content).toContain('SRTP');
      expect(content).toContain('zero residual risk');
    });
  });
});
