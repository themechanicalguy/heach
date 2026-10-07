/**
 * Flags user-facing text written directly in JSX instead of coming from messages (I18N-02).
 * Warn mode in Step 1; Step 2 switches `level` to 'error' when ICU catalogues arrive.
 * Built on ESLint's no-restricted-syntax, so no extra plugin is needed.
 */
const level = 'warn';

const TEXT_ATTRIBUTES = ['alt', 'aria-label', 'aria-description', 'placeholder', 'title', 'label'];
const MESSAGE = 'User-facing text must come from messages via t(key), not be hard-coded (I18N-02).';

export default [
  {
    files: ['**/*.tsx', '**/*.jsx'],
    ignores: ['**/*.test.tsx', '**/*.test.jsx', '**/*.stories.tsx', 'e2e/**'],
    rules: {
      'no-restricted-syntax': [
        level,
        // Text between tags containing at least one letter (any script): <p>Hello</p>
        { selector: 'JSXText[value=/\\p{L}/u]', message: MESSAGE },
        // String literals in JSX expressions: <p>{'Hello'}</p>
        {
          selector: 'JSXExpressionContainer > Literal[value=/\\p{L}/u]',
          message: MESSAGE,
        },
        // Visible or announced attributes: alt="Doctor", aria-label="Close"
        {
          selector: `JSXAttribute[name.name=/^(${TEXT_ATTRIBUTES.join('|')})$/] > Literal`,
          message: MESSAGE,
        },
      ],
    },
  },
];
