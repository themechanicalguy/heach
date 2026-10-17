import type { StorybookConfig } from '@storybook/react-vite';

/** Component docs for @heach/ui (UX-01.1). No telemetry, no add-ons beyond the core. */
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
};

export default config;
