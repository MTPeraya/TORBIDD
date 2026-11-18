// =============================================================================
// lib/global-error-handler.ts - Global Node.js Process Error Handlers
// SEC-22: Fail-Secure Error Handling (OWASP ASVS req_id 16.5.4)
// Catches unhandledRejection and uncaughtException to prevent process crashes.
// =============================================================================

import { logSystemError } from './audit-logger';

let isInitialized = false;

/**
 * ASVS req_id 16.5.4: Last-resort global error handler for uncaught exceptions & unhandled rejections.
 * Ensures fatal errors are captured in structured audit logs and prevents loss of availability.
 */
export function initGlobalProcessErrorHandlers(): void {
  if (isInitialized || typeof process === 'undefined') return;
  isInitialized = true;

  process.on('uncaughtException', (error: Error) => {
    logSystemError('UNCAUGHT_EXCEPTION', error, {
      name: error?.name || 'Error',
      fatal: true,
    });
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logSystemError('UNHANDLED_REJECTION', err, {
      reason: String(reason),
      fatal: false,
    });
  });
}

// Auto-initialize on server runtime
if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.on === 'function') {
  initGlobalProcessErrorHandlers();
}
