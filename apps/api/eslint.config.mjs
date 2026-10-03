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
];
