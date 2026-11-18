// =============================================================================
// src/instrumentation.ts - Next.js Server Startup Hook & 5-Hour Auto-Sync
// =============================================================================

declare global {
  var __torbiddAutoSyncInitialized: boolean | undefined;
}

const CHECK_INTERVAL_MS = 30 * 60 * 1000; // Check every 30 mins; checkAndAutoSync() enforces the 5-hour interval
const INITIAL_DELAY_MS = 5 * 1000; // Wait 5s after server boot before initial check

export async function register() {
  // Run only in Node.js server runtime (skip Edge runtime and production build phase)
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.NEXT_PHASE === 'phase-production-build'
  ) {
    return;
  }

  // Prevent duplicate timers across Next.js dev hot-reloads
  if (globalThis.__torbiddAutoSyncInitialized) {
    return;
  }
  globalThis.__torbiddAutoSyncInitialized = true;

  const { checkAndAutoSync } = await import('@/services/ingestion/sync-state');

  // 1. Check shortly after server startup (catches up immediately if >5h passed while offline)
  const initialTimer = setTimeout(() => {
    void checkAndAutoSync().catch((err) => {
      console.warn('[Instrumentation] Initial auto-sync check failed:', err);
    });
  }, INITIAL_DELAY_MS);
  initialTimer.unref?.();

  // 2. Keep checking periodically while the server stays running
  const intervalTimer = setInterval(() => {
    void checkAndAutoSync().catch((err) => {
      console.warn('[Instrumentation] Scheduled auto-sync check failed:', err);
    });
  }, CHECK_INTERVAL_MS);
  intervalTimer.unref?.();

  console.log('[Instrumentation] 5-hour procurement auto-sync scheduler registered');
}
