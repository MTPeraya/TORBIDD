// =============================================================================
// lib/audit-logger.ts - Structured JSON Security Audit Logger
// SEC-22: Security Audit Logging & Fail-Secure Error Handling (ASVS Chapter 16)
// =============================================================================

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';
export type EventOutcome = 'SUCCESS' | 'FAILURE' | 'BLOCKED';

export interface SecurityLogEntry {
  timestamp: string; // ISO 8601 UTC
  level: LogLevel;
  eventType: string; // e.g. AUTH_LOGIN, AUTHZ_FORBIDDEN, RATE_LIMIT_EXCEEDED
  userId?: string | null;
  clientIp?: string | null;
  resource?: string;
  outcome: EventOutcome;
  details?: Record<string, unknown>;
  error?: {
    message: string;
    code?: string;
  };
}

/** Sensitive keys whose values must be automatically redacted in log payloads */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /cookie/i,
  /authorization/i,
  /bearer/i,
  /credential/i,
  /private_?key/i,
  /session/i,
];

/**
 * ASVS req_id 16.4.1: Sanitizes untrusted user strings against log injection
 * Replaces CRLF characters (\r, \n) with escaped literals to prevent forging log records.
 */
export function sanitizeLogString(val: string): string {
  if (typeof val !== 'string') return String(val);
  return val
    .replace(/\r\n/g, '\\r\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

/**
 * ASVS req_id 16.2.5: Recursively redacts sensitive tokens, passwords, and secrets
 */
export function redactSensitiveData<T>(input: T): T {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    // Check if string itself looks like a Bearer token or secret
    if (/^Bearer\s+[A-Za-z0-9-_.]+/i.test(input)) {
      return 'Bearer [REDACTED]' as unknown as T;
    }
    return sanitizeLogString(input) as unknown as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item)) as unknown as T;
  }

  if (typeof input === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = redactSensitiveData(value);
      }
    }
    return clean as T;
  }

  return input;
}

/**
 * Formats a security audit event into a structured JSON string.
 * ASVS req_id 16.2.1, 16.2.2, 16.2.4
 */
export function formatSecurityLog(entry: Omit<SecurityLogEntry, 'timestamp'>): string {
  const sanitizedDetails = entry.details ? redactSensitiveData(entry.details) : undefined;
  const sanitizedError = entry.error
    ? {
        message: sanitizeLogString(entry.error.message),
        code: entry.error.code ? sanitizeLogString(entry.error.code) : undefined,
      }
    : undefined;

  const logPayload: SecurityLogEntry = {
    // ASVS req_id 16.2.2: Enforce ISO 8601 UTC timestamp
    timestamp: new Date().toISOString(),
    level: entry.level,
    eventType: sanitizeLogString(entry.eventType),
    userId: entry.userId ? sanitizeLogString(entry.userId) : null,
    clientIp: entry.clientIp ? sanitizeLogString(entry.clientIp) : null,
    resource: entry.resource ? sanitizeLogString(entry.resource) : undefined,
    outcome: entry.outcome,
    details: sanitizedDetails,
    error: sanitizedError,
  };

  return JSON.stringify(logPayload);
}

/**
 * Dispatches the formatted log to standard output / logging stream.
 */
export function emitAuditLog(entry: Omit<SecurityLogEntry, 'timestamp'>): void {
  const jsonStr = formatSecurityLog(entry);
  if (entry.level === 'ERROR') {
    console.error(jsonStr);
  } else if (entry.level === 'WARN' || entry.level === 'SECURITY') {
    console.warn(jsonStr);
  } else {
    console.info(jsonStr);
  }
}

// ── Specialized Event Helpers ───────────────────────────────────────────────

/** ASVS req_id 16.3.1: Log successful authentication operations */
export function logAuthSuccess(
  userId: string,
  clientIp?: string | null,
  details?: Record<string, unknown>,
): void {
  emitAuditLog({
    level: 'INFO',
    eventType: 'AUTH_LOGIN_SUCCESS',
    userId,
    clientIp,
    outcome: 'SUCCESS',
    details,
  });
}

/** ASVS req_id 16.3.1: Log failed authentication attempts */
export function logAuthFailure(
  attemptedIdentifier: string,
  clientIp?: string | null,
  reason?: string,
  details?: Record<string, unknown>,
): void {
  emitAuditLog({
    level: 'SECURITY',
    eventType: 'AUTH_LOGIN_FAILURE',
    userId: attemptedIdentifier,
    clientIp,
    outcome: 'FAILURE',
    details: { reason, ...details },
  });
}

/** ASVS req_id 16.3.2: Log failed authorization attempts (e.g. 403 Forbidden) */
export function logAuthzFailure(
  userId: string | null | undefined,
  clientIp: string | null | undefined,
  resource: string,
  reason: string,
  details?: Record<string, unknown>,
): void {
  emitAuditLog({
    level: 'SECURITY',
    eventType: 'AUTHZ_ACCESS_DENIED',
    userId: userId || null,
    clientIp: clientIp || null,
    resource,
    outcome: 'BLOCKED',
    details: { reason, ...details },
  });
}

/** ASVS req_id 16.3.3: Log security control bypass, rate limit, or validation failure */
export function logSecurityEvent(
  eventType: string,
  clientIp: string | null | undefined,
  details?: Record<string, unknown>,
  outcome: EventOutcome = 'BLOCKED',
): void {
  emitAuditLog({
    level: 'SECURITY',
    eventType,
    clientIp: clientIp || null,
    outcome,
    details,
  });
}

/** ASVS req_id 16.3.4: Log unexpected system errors & external dependency failures */
export function logSystemError(
  eventType: string,
  error: unknown,
  details?: Record<string, unknown>,
): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  emitAuditLog({
    level: 'ERROR',
    eventType,
    outcome: 'FAILURE',
    details,
    error: {
      message: errMsg,
    },
  });
}
