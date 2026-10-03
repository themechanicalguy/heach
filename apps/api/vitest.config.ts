import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits the decorator metadata that Nest dependency injection needs.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
    setupFiles: ['reflect-metadata'],
    projects: [
      { extends: true, test: { name: 'unit', include: ['src/**/*.spec.ts'] } },
      { extends: true, test: { name: 'integration', include: ['test/**/*.int-spec.ts'] } },
    ],
  },
});
