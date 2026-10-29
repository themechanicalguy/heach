import path from 'node:path';
import type { NextConfig } from 'next';

// The container build sets NEXT_OUTPUT=standalone for a small self-contained server;
// local `next start` (used by the smoke tests) needs the default output.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

// Locally the API runs on its own port; on hosts Caddy routes /api before Next sees it.
const apiOrigin = process.env.API_ORIGIN;

// Browser source maps only for an upload to GlitchTip, which then deletes them
// (scripts/upload-source-maps.mjs, LM-03.1); never served or shipped in an image.
const sourceMaps = process.env.SOURCE_MAPS === 'upload';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // No Next.js dev-tools badge over the pages in `next dev`; production builds never show it.
  devIndicators: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: sourceMaps,
  // Modern formats only (PF-05.1).
  images: { formats: ['image/avif', 'image/webp'] },
  ...(standalone && {
    output: 'standalone',
    outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  }),
  ...(apiOrigin && {
    rewrites: () =>
      Promise.resolve([{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }]),
  }),
  headers: () =>
    Promise.resolve([
      // The service worker must update promptly; browsers check this file on each visit.
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ]),
};

export default nextConfig;
