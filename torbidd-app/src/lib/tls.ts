// =============================================================================
// lib/tls.ts - SEC-18 transport-security policy and runtime validation
// =============================================================================

const LOCAL_MONGODB_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

/** Reject any attempt to disable Node.js certificate validation. */
export function assertTlsCertificateValidation(
  env: Partial<NodeJS.ProcessEnv> = process.env,
): void {
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0') {
    throw new Error(
      'NODE_TLS_REJECT_UNAUTHORIZED=0 is prohibited; remote TLS certificates must be validated',
    );
  }

  if (env.NODE_ENV === 'production' && env.NODE_TLS_REJECT_UNAUTHORIZED !== '1') {
    throw new Error('NODE_TLS_REJECT_UNAUTHORIZED must be set to 1 in production');
  }
}

/** Parse and require an HTTPS URL for outbound service communication. */
export function assertHttpsUrl(input: string, label = 'Service URL'): URL {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`${label} must be a valid HTTPS URL`);
  }

  if (url.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS; received ${url.protocol || 'an unknown protocol'}`);
  }

  if (url.username || url.password) {
    throw new Error(`${label} must not contain credentials`);
  }

  return url;
}

export interface MongoTlsPolicy {
  tls: boolean;
  isLocalDevelopment: boolean;
}

/**
 * Require Atlas SRV plus explicit TLS in production. Local standalone MongoDB
 * remains available only in development/test so mongodb-memory-server can run.
 */
export function assertSecureMongoUri(
  uri: string,
  env: Partial<NodeJS.ProcessEnv> = process.env,
): MongoTlsPolicy {
  assertTlsCertificateValidation(env);

  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string');
  }

  if (url.protocol === 'mongodb+srv:') {
    if (url.searchParams.get('tls') !== 'true') {
      throw new Error('MongoDB Atlas URI must explicitly include tls=true');
    }
    return { tls: true, isLocalDevelopment: false };
  }

  const localDevelopment =
    url.protocol === 'mongodb:' &&
    LOCAL_MONGODB_HOSTS.has(url.hostname) &&
    env.NODE_ENV !== 'production';

  if (localDevelopment) {
    return { tls: false, isLocalDevelopment: true };
  }

  throw new Error('MONGODB_URI must use mongodb+srv:// with tls=true');
}
