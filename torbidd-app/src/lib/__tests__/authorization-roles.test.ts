// =============================================================================
// lib/__tests__/authorization-roles.test.ts – SEC-05 RBAC permission tests
// ASVS V8.1.1, V8.2.1 – Role-based access control
// =============================================================================

import { hasPermission, PERMISSIONS, type Permission } from '../authorization/permissions';

describe('SEC-05 RBAC permission checks', () => {
  it('admin has admin:users permission', () => {
    expect(hasPermission('admin', 'admin:users')).toBe(true);
  });

  it('BMA Officer does NOT have admin:users permission', () => {
    expect(hasPermission('BMA Officer', 'admin:users')).toBe(false);
  });

  it('BMA Officer has read:procurement permission', () => {
    expect(hasPermission('BMA Officer', 'read:procurement')).toBe(true);
  });

  it('anonymous does NOT have write:bookmark', () => {
    expect(hasPermission('anonymous', 'write:bookmark')).toBe(false);
  });

  it('admin has all admin permissions', () => {
    const adminPerms: Permission[] = [
      'admin:users',
      'admin:sync',
      'admin:ai',
      'admin:classification',
    ];
    adminPerms.forEach((p) => expect(hasPermission('admin', p)).toBe(true));
  });

  it('BMA Officer has write:bookmark permission', () => {
    expect(hasPermission('BMA Officer', 'write:bookmark')).toBe(true);
  });

  it('BMA Officer has write:profile permission', () => {
    expect(hasPermission('BMA Officer', 'write:profile')).toBe(true);
  });

  it('BMA Officer has read:notifications permission', () => {
    expect(hasPermission('BMA Officer', 'read:notifications')).toBe(true);
  });

  it('anonymous has read:procurement permission', () => {
    expect(hasPermission('anonymous', 'read:procurement')).toBe(true);
  });

  it('anonymous does NOT have admin:sync permission', () => {
    expect(hasPermission('anonymous', 'admin:sync')).toBe(false);
  });

  it('unknown role falls back to anonymous permissions', () => {
    expect(hasPermission('unknown_role', 'admin:users')).toBe(false);
    expect(hasPermission('unknown_role', 'read:procurement')).toBe(true);
  });
});
