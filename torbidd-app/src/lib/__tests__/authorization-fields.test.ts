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
    it('strips role field from BMA Officer profile update', () => {
      const body = { name: 'Alice', role: 'admin' };
      const stripped = stripUnauthorizedFields(body, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
      expect(stripped).not.toHaveProperty('role');
      expect(stripped).toHaveProperty('name', 'Alice');
    });

    it('allows admin to submit role field', () => {
      const body = { name: 'Alice', role: 'admin' };
      const stripped = stripUnauthorizedFields(body, 'admin', ADMIN_ONLY_USER_FIELDS);
      expect(stripped).toHaveProperty('role', 'admin');
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
    it('detects blocked field for BMA Officer', () => {
      const result = rejectUnauthorizedFields({ role: 'admin' }, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
      expect(result.rejected).toBe(true);
      expect(result.fields).toContain('role');
    });

    it('passes clean body for BMA Officer', () => {
      const result = rejectUnauthorizedFields({ name: 'Bob' }, 'BMA Officer', ADMIN_ONLY_USER_FIELDS);
      expect(result.rejected).toBe(false);
      expect(result.fields).toHaveLength(0);
    });

    it('does not reject role field for admin', () => {
      const result = rejectUnauthorizedFields({ role: 'admin' }, 'admin', ADMIN_ONLY_USER_FIELDS);
      expect(result.rejected).toBe(false);
    });

    it('detects multiple blocked fields', () => {
      const result = rejectUnauthorizedFields(
        { role: 'admin', name: 'Alice', category: 'AI', isSoftwareRelated: true },
        'BMA Officer',
        [...ADMIN_ONLY_USER_FIELDS, ...ADMIN_ONLY_PROJECT_FIELDS],
      );
      expect(result.rejected).toBe(true);
      expect(result.fields).toContain('role');
      expect(result.fields).toContain('category');
      expect(result.fields).toContain('isSoftwareRelated');
      expect(result.fields).not.toContain('name'); // allowed field
    });
  });

  // ---------------------------------------------------------------------------
  // ASVS V8.1.2 — documented field-level restrictions
  // ---------------------------------------------------------------------------
  describe('ADMIN_ONLY_USER_FIELDS', () => {
    it('contains role', () => {
      expect(ADMIN_ONLY_USER_FIELDS).toContain('role');
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
