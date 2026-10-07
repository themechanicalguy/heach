import base from '@heach/config/eslint';
import i18n from '@heach/config/eslint/i18n';
import nextPlugin from '@next/eslint-plugin-next';

export default [
  { ignores: ['.next/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**'] },
  ...base,
  {
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
  ...i18n,
];
