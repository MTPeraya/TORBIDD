// =============================================================================
// lib/authorization/fields.ts – Field-level authorization
// SEC-07: Field-Level Authorization — ASVS V8.1.2, V8.2.3
// =============================================================================
// Defines which data fields are restricted to administrators, and provides
// helpers to strip or reject unauthorized field submissions.
//
// This prevents Broken Object Property Level Authorization (BOPLA) where
// ordinary users manipulate API requests to read or modify admin-only fields.
// =============================================================================

/**
 * User profile fields that only administrators may write.
 * Ordinary users (BMA Officer) cannot modify these fields via API.
 *
 * ASVS V8.1.2: Field-level access restrictions are documented here.
 */
export const ADMIN_ONLY_USER_FIELDS: readonly string[] = ['role'] as const;

/**
 * Project / procurement record fields that only administrators may write.
 * These are AI-generated classification fields that only admins can correct.
 *
 * Ordinary users cannot override AI classifications through manipulated API requests.
 */
export const ADMIN_ONLY_PROJECT_FIELDS: readonly string[] = [
  'category',
  'isSoftwareRelated',
  'classificationReviewStatus',
  'classificationReviewNote',
  'classificationReviewedBy',
  'classificationReviewedAt',
] as const;

/**
 * Returns a copy of `body` with any admin-only fields removed,
 * when the requesting role is not 'admin'.
 *
 * ASVS V8.2.3: Enforces field-level authorization at the backend.
 *
 * @param body          The incoming request body.
 * @param role          The authenticated user's role.
 * @param blockedFields The list of field names blocked for non-admins.
 * @returns             A new object with blocked fields omitted for non-admins.
 */
export function stripUnauthorizedFields<T extends object>(
  body: T,
  role: string,
  blockedFields: readonly string[],
): Partial<T> {
  if (role === 'admin' || role === 'administrator') {
    return { ...body };
  }
  const result = { ...body } as Record<string, unknown>;
  for (const field of blockedFields) {
    delete result[field];
  }
  return result as Partial<T>;
}

/**
 * Returns whether the submitted body contains any admin-only fields
 * that the non-admin user is not permitted to submit.
 *
 * Use this to return an explicit 400 error rather than silently stripping fields,
 * when the API should signal the violation to the caller.
 *
 * @param body          The incoming request body.
 * @param role          The authenticated user's role.
 * @param blockedFields The list of field names blocked for non-admins.
 * @returns             `{ rejected: true, fields: string[] }` if blocked fields present.
 */
export function rejectUnauthorizedFields(
  body: object,
  role: string,
  blockedFields: readonly string[],
): { rejected: boolean; fields: string[] } {
  if (role === 'admin' || role === 'administrator') {
    return { rejected: false, fields: [] };
  }
  const bodyKeys = Object.keys(body);
  const violatingFields = blockedFields.filter((f) => bodyKeys.includes(f));
  return {
    rejected: violatingFields.length > 0,
    fields: violatingFields,
  };
}
