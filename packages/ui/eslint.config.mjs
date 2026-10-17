import base from '@heach/config/eslint';
import i18n from '@heach/config/eslint/i18n';

export default [{ ignores: ['dist/**', 'storybook-static/**'] }, ...base, ...i18n];
