import base from '@heach/config/eslint';
import i18n from '@heach/config/eslint/i18n';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'playwright-report/**', 'test-results/**'] },
  ...base,
  reactHooks.configs.flat.recommended,
  ...i18n,
  {
    // E2E suites skip when the full stack is absent; that is intended.
    files: ['e2e/**'],
    rules: { 'sonarjs/no-skipped-tests': 'off' },
  },
];
