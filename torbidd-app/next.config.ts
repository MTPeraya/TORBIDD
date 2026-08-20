import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Allow large PDF uploads for AI extraction (10 MB)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
