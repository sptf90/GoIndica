import type { NextConfig } from 'next';
const config: NextConfig = {
  // Permite validar um build sem sobrescrever o servidor de desenvolvimento em execução.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  experimental: { serverActions: { bodySizeLimit: '6mb' } },
  images: { remotePatterns: [{ protocol: 'https', hostname: 'lh*.googleusercontent.com' }] },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};
export default config;
