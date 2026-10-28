import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Locally the API runs on its own port; on hosts Caddy routes /api on the admin site instead.
const apiOrigin = process.env.API_ORIGIN ?? 'http://localhost:3001';
const proxy = {
  '/api': { target: apiOrigin, rewrite: (path: string) => path.replace(/^\/api/, '') },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy },
  build: {
    target: 'es2022',
    // Source maps are uploaded privately to error tracking in Step 2, never served.
    sourcemap: false,
  },
});
