import type { NextConfig } from 'next';
import { SECURITY_HEADERS } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  // Standalone output bundles only what's needed to run the server.
  // This is required for the multi-stage Docker build (Stage 3: runner).
  // The resulting .next/standalone/server.js is the production entrypoint.
  output: 'standalone',

  // Disable X-Powered-By header to prevent backend fingerprinting (ASVS V13.4.2 & V13.4.6)
  poweredByHeader: false,

  // Disable browser source maps in production to prevent source code leakage (ASVS V13.4.7)
  productionBrowserSourceMaps: false,

  // Allow large PDF uploads for AI extraction (10 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    trustHostHeader: true,
  },

  // Security Headers (ASVS 3.4.1 & 3.4.3)
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [
      {
        source: '/:path*',
        headers: isDev
          ? SECURITY_HEADERS.filter((h) => h.key !== 'Strict-Transport-Security')
          : SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
