import base from '@heach/config/eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'playwright-report/**', 'test-results/**'] },
  ...base,
  reactHooks.configs.flat.recommended,
];
