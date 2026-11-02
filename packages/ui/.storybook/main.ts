import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';

/** Component docs for @heach/ui (UX-01.1). No telemetry, no add-ons beyond the core. */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx', '../../../apps/web/src/components/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: {} },
  viteFinal(config) {
    return {
      ...config,
      oxc: { jsx: { runtime: 'automatic' } },
      resolve: {
        ...config.resolve,
        alias: {
          'next/navigation': fileURLToPath(
            new URL('../../../apps/web/src/components/site/story-navigation.ts', import.meta.url),
          ),
        },
      },
    };
  },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
};

export default config;
