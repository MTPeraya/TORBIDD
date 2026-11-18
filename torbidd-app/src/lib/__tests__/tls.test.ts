/**
 * @jest-environment node
 */
import {
  assertHttpsUrl,
  assertSecureMongoUri,
  assertTlsCertificateValidation,
} from '../tls';

describe('SEC-18 transport security policy', () => {
  it('accepts HTTPS service endpoints and rejects cleartext HTTP', () => {
    expect(assertHttpsUrl('https://process5.gprocurement.go.th').protocol).toBe('https:');
    expect(() => assertHttpsUrl('http://egp2.bangkok.go.th')).toThrow(/must use HTTPS/i);
  });

  it('rejects URLs containing embedded credentials', () => {
    expect(() => assertHttpsUrl('https://user:pass@example.com')).toThrow(/credentials/i);
  });

  it('requires Atlas SRV and explicit tls=true in production', () => {
    const env = { NODE_ENV: 'production', NODE_TLS_REJECT_UNAUTHORIZED: '1' } as const;
    expect(
      assertSecureMongoUri('mongodb+srv://user:pass@cluster.example.net/db?tls=true', env),
    ).toEqual({ tls: true, isLocalDevelopment: false });
    expect(() =>
      assertSecureMongoUri('mongodb+srv://user:pass@cluster.example.net/db', env),
    ).toThrow(/tls=true/i);
    expect(() =>
      assertSecureMongoUri('mongodb://db.internal:27017/torbidd?tls=true', env),
    ).toThrow(/mongodb\+srv/i);
  });

  it('permits localhost MongoDB only outside production', () => {
    expect(
      assertSecureMongoUri('mongodb://127.0.0.1:27017/test', { NODE_ENV: 'test' }),
    ).toEqual({ tls: false, isLocalDevelopment: true });
  });

  it('rejects disabled certificate validation', () => {
    expect(() =>
      assertTlsCertificateValidation({
        NODE_ENV: 'production',
        NODE_TLS_REJECT_UNAUTHORIZED: '0',
      }),
    ).toThrow(/prohibited/i);
  });
});
