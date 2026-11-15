// =============================================================================
// lib/authorization/index.ts – Barrel re-export for the authorization module
// SEC-05/06/07/08: RBAC, Ownership, Field-Level, Backend Authorization
// =============================================================================
// All imports from '@/lib/authorization' resolve through this barrel.
// The original `src/lib/authorization.ts` file is kept as a compatibility
// re-export so existing code that imports from that path is not broken.
// =============================================================================

// SEC-05: Roles and permission matrix
export * from './roles';
export * from './permissions';

// SEC-06: Resource ownership
export * from './ownership';

// SEC-07: Field-level authorization
export * from './fields';

// SEC-08: Backend authorization enforcement helpers
// Note: backend.ts imports NextResponse (requires web runtime) so it is NOT
// re-exported here to avoid breaking Jest tests that run in Node environment.
// Import directly from '@/lib/authorization/backend' in route handlers.
// export * from './backend'; // intentionally excluded from barrel
