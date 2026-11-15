// =============================================================================
// lib/__tests__/authorization-fields.test.ts
// SEC-07: Field-Level Authorization — ASVS V8.1.2, V8.2.3
// =============================================================================

import {
  stripUnauthorizedFields,
  rejectUnauthorizedFields,
  ADMIN_ONLY_USER_FIELDS,
  ADMIN_ONLY_PROJECT_FIELDS,
} from '../authorization/fields';

describe('SEC-07 field-level authorization', () => {
  // ---------------------------------------------------------------------------
  // stripUnauthorizedFields
  // ---------------------------------------------------------------------------
  describe('stripUnauthorizedFields', () => {
    it('strips administrative fields from BMA Officer profile update', () => {
      const body = { name: 'Alice', isAdmin: true, permissions: ['all'] };
      const stripped = stripUnauthorizedFields(body, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
      expect(stripped).not.toHaveProperty('isAdmin');
      expect(stripped).not.toHaveProperty('permissions');
      expect(stripped).toHaveProperty('name', 'Alice');
    });

    it('allows admin to submit administrative fields', () => {
      const body = { name: 'Alice', isAdmin: true };
      const stripped = stripUnauthorizedFields(body, 'admin', ADMIN_ONLY_USER_FIELDS);
      expect(stripped).toHaveProperty('isAdmin', true);
    });

    it('strips all ADMIN_ONLY_PROJECT_FIELDS for BMA Officer', () => {
      const body = {
        title: 'Some project',
        category: 'AI',
        isSoftwareRelated: true,
        classificationReviewStatus: 'APPROVED',
      };
      const stripped = stripUnauthorizedFields(body, 'BMA Officer', ADMIN_ONLY_PROJECT_FIELDS);
      expect(stripped).toHaveProperty('title');
      expect(stripped).not.toHaveProperty('category');
      expect(stripped).not.toHaveProperty('isSoftwareRelated');
      expect(stripped).not.toHaveProperty('classificationReviewStatus');
    });

    it('passes all fields for admin', () => {
      const body = {
        title: 'Some project',
        category: 'AI',
        isSoftwareRelated: true,
      };
      const stripped = stripUnauthorizedFields(body, 'admin', ADMIN_ONLY_PROJECT_FIELDS);
      expect(stripped).toHaveProperty('category', 'AI');
      expect(stripped).toHaveProperty('isSoftwareRelated', true);
    });

    it('does not mutate the original body', () => {
      const body = { name: 'Alice', role: 'admin' };
      stripUnauthorizedFields(body, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
      expect(body).toHaveProperty('role', 'admin'); // original unchanged
    });
  });

  // ---------------------------------------------------------------------------
  // rejectUnauthorizedFields
  // ---------------------------------------------------------------------------
  describe('rejectUnauthorizedFields', () => {
    it('detects blocked administrative field for BMA Officer', () => {
      const result = rejectUnauthorizedFields({ isAdmin: true }, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
      expect(result.rejected).toBe(true);
      expect(result.fields).toContain('isAdmin');
    });

    it('passes clean body for BMA Officer', () => {
      const result = rejectUnauthorizedFields({ name: 'Bob' }, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
      expect(result.rejected).toBe(false);
      expect(result.fields).toHaveLength(0);
    });

    it('does not reject administrative field for admin', () => {
      const result = rejectUnauthorizedFields({ isAdmin: true }, 'admin', ADMIN_ONLY_USER_FIELDS);
      expect(result.rejected).toBe(false);
    });

    it('detects multiple blocked fields', () => {
      const result = rejectUnauthorizedFields(
        { isAdmin: true, permissions: ['write:all'], name: 'Alice', category: 'AI', isSoftwareRelated: true },
        'BMA Officer',
        [...ADMIN_ONLY_USER_FIELDS, ...ADMIN_ONLY_PROJECT_FIELDS],
      );
      expect(result.rejected).toBe(true);
      expect(result.fields).toContain('isAdmin');
      expect(result.fields).toContain('category');
      expect(result.fields).toContain('isSoftwareRelated');
      expect(result.fields).not.toContain('name'); // allowed field
    });
  });

  // ---------------------------------------------------------------------------
  // ASVS V8.1.2 — documented field-level restrictions
  // ---------------------------------------------------------------------------
  describe('ADMIN_ONLY_USER_FIELDS', () => {
    it('contains administrative privilege flags', () => {
      expect(ADMIN_ONLY_USER_FIELDS).toContain('isAdmin');
      expect(ADMIN_ONLY_USER_FIELDS).toContain('permissions');
      expect(ADMIN_ONLY_USER_FIELDS).toContain('isSuperuser');
    });
  });

  describe('ADMIN_ONLY_PROJECT_FIELDS', () => {
    it('contains classification fields', () => {
      expect(ADMIN_ONLY_PROJECT_FIELDS).toContain('category');
      expect(ADMIN_ONLY_PROJECT_FIELDS).toContain('isSoftwareRelated');
      expect(ADMIN_ONLY_PROJECT_FIELDS).toContain('classificationReviewStatus');
      expect(ADMIN_ONLY_PROJECT_FIELDS).toContain('classificationReviewNote');
    });
  });
});
