// =============================================================================
// lib/authorization.ts – Legacy import-path compatibility shim
// =============================================================================
// All authorization logic has been moved to src/lib/authorization/ (directory).
// This file is kept as a barrel re-export so existing imports from
// '@/lib/authorization' continue to resolve without changes.
//
// SEC-05/06/07/08: RBAC, Ownership, Field-Level, and Backend Authorization.
// =============================================================================
// DO NOT add new logic here — add it to src/lib/authorization/*.ts instead.
// =============================================================================

export * from './authorization/index';
