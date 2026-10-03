import { t } from './messages';
import en from '../../messages/en.json';

describe('web messages', () => {
  it('resolves the home title from messages/en.json', () => {
    expect(t('home.title')).toBe(en.home.title);
  });
});
