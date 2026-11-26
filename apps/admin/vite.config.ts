import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Locally the API runs on its own port; on hosts Caddy routes /api on the admin site instead.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001';
const proxy = {
  '/api': { target: apiOrigin, rewrite: (path: string) => path.replace(/^\/api/, '') },
};

// Source maps only for an upload to GlitchTip, which then deletes them
// (scripts/upload-source-maps.mjs, LM-03.1); never served.
const sourceMaps = process.env.SOURCE_MAPS === 'upload';

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: {
    target: 'es2022',
    sourcemap: sourceMaps,
  },
});
