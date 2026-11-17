// =============================================================================
// lib/authorization/ownership.ts – Resource ownership validation
// SEC-06: Resource Ownership and Object-Level Authorization — ASVS V8.2.2
// =============================================================================
// Provides helpers to verify that a user owns the resource they are attempting
// to access or modify, preventing IDOR / BOLA vulnerabilities.
// =============================================================================

/**
 * Verifies that the requesting user is the owner of a bookmark.
 *
 * @param requestingUserId  The ID of the user making the request.
 * @param bookmarkOwnerId   The ID stored on the bookmark record.
 * @returns true if the IDs match (ownership confirmed).
 *
 * ASVS V8.2.2: Restricts data-specific access to consumers with explicit permissions.
 */
export function verifyBookmarkOwnership(
  requestingUserId: string,
  bookmarkOwnerId: string,
): boolean {
  if (!requestingUserId || !bookmarkOwnerId) return false;
  return requestingUserId === bookmarkOwnerId;
}

/**
 * Generic resource ownership check.
 * Returns true when the requesting user ID matches the resource owner ID.
 *
 * @param requestingUserId The ID of the user making the request.
 * @param resourceOwnerId  The ID of the user who owns the resource.
 */
export function verifyOwnership(
  requestingUserId: string,
  resourceOwnerId: string,
): boolean {
  if (!requestingUserId || !resourceOwnerId) return false;
  return requestingUserId === resourceOwnerId;
}
