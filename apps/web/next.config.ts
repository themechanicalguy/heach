import path from 'node:path';
import type { NextConfig } from 'next';

// The container build sets NEXT_OUTPUT=standalone for a small self-contained server;
// local `next start` (used by the smoke tests) needs the default output.
const standalone = process.env.NEXT_OUTPUT === 'standalone';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(standalone && {
    output: 'standalone',
    outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  }),
};

export default nextConfig;
