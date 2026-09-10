import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output bundles only what's needed to run the server.
  // This is required for the multi-stage Docker build (Stage 3: runner).
  // The resulting .next/standalone/server.js is the production entrypoint.
  output: 'standalone',

  // Allow large PDF uploads for AI extraction (10 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
