import { CATALOGUES } from '@heach/i18n';
import { translatorFor } from './messages';

describe('web messages', () => {
  it('I18N-01.1 resolves messages for each locale', () => {
    expect(translatorFor('or').t('home.title')).toBe(CATALOGUES.or.home.title);
    expect(translatorFor('hi').t('home.title')).toBe(CATALOGUES.hi.home.title);
  });

  it('falls back to Odia for an unknown locale', () => {
    expect(translatorFor('fr').locale).toBe('or');
  });
});
