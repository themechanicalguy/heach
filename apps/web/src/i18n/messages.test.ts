import { t, type MessageKey } from './messages';
import en from '../../messages/en.json';

describe('t', () => {
  it('returns the English message for a key', () => {
    expect(t('home.title')).toBe(en.home.title);
  });

  it('throws for a key that does not exist', () => {
    expect(() => t('home.missing' as MessageKey)).toThrow('Missing message: home.missing');
  });
});
