import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // Source maps are uploaded privately to error tracking in Step 2, never served.
    sourcemap: false,
  },
});
