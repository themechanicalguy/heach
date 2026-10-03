import js from '@eslint/js';
import sonarjs from 'eslint-plugin-sonarjs';
import tseslint from 'typescript-eslint';

/**
 * Shared ESLint flat config. Apps and packages spread this and add their own rules.
 * Type-aware rules read the nearest tsconfig.json of each linted file.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/.turbo/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  sonarjs.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      'max-lines-per-function': [
        'error',
        { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      'no-console': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
);
