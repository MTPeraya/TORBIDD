/**
 * @jest-environment node
 */
import { assertProductionSessionSecret } from '../auth';

describe('Production Startup Secrets Validation (T-02)', () => {
  const originalEnv = process.env.NODE_ENV;

  const setNodeEnv = (val: string | undefined) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = val;
  };

  afterEach(() => {
    setNodeEnv(originalEnv);
  });

  it('1. passes in non-production environments regardless of secret value', () => {
    setNodeEnv('development');
    expect(() => assertProductionSessionSecret('short')).not.toThrow();
    expect(() => assertProductionSessionSecret('')).not.toThrow();
  });

  it('2. throws in production environment if secret is empty or missing', () => {
    setNodeEnv('production');
    expect(() => assertProductionSessionSecret('')).toThrow(
      'FATAL: Insecure or default SESSION_SECRET in production environment',
    );
    expect(() => assertProductionSessionSecret(undefined)).toThrow(
      'FATAL: Insecure or default SESSION_SECRET in production environment',
    );
  });

  it('3. throws in production environment if secret is shorter than 32 characters (256-bit entropy threshold)', () => {
    setNodeEnv('production');
    expect(() => assertProductionSessionSecret('short_key_under_32_chars')).toThrow(
      'FATAL: Insecure or default SESSION_SECRET in production environment',
    );
  });

  it('4. throws in production environment if secret contains placeholder or change-me', () => {
    setNodeEnv('production');
    expect(() => assertProductionSessionSecret('placeholder_secret_key_that_is_long_enough_12345')).toThrow(
      'FATAL: Insecure or default SESSION_SECRET in production environment',
    );
    expect(() => assertProductionSessionSecret('change-me_secret_key_that_is_long_enough_12345')).toThrow(
      'FATAL: Insecure or default SESSION_SECRET in production environment',
    );
  });

  it('5. succeeds in production when secret is >= 32 characters and high entropy', () => {
    setNodeEnv('production');
    const strongSecret = 'e067b247772c5b2d93602b9ea302593f9ea12573c7cf2f39346758c88e9d2861';
    expect(() => assertProductionSessionSecret(strongSecret)).not.toThrow();
  });
});
