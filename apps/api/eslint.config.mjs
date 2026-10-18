import base from '@heach/config/eslint';

export default [
  { ignores: ['dist/**'] },
  ...base,
  {
    rules: {
      // Nest dependency injection needs classes imported as values for decorator metadata.
      '@typescript-eslint/consistent-type-imports': 'off',
      // Nest modules and DTOs are decorated classes, often with no members.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  },
  {
    // TS-06.1: app code depends on the adapter ports only; implementations are bound in
    // adapters.module.ts and used directly only by tests.
    files: ['src/**/*.ts'],
    ignores: ['src/adapters/adapters.module.ts', '**/*.spec.ts', 'test/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/adapters/fakes*'],
              message:
                'Inject the adapter port; only adapters.module.ts binds implementations (TS-06.1).',
            },
          ],
        },
      ],
    },
  },
];
