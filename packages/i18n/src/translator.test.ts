import { createTranslator, type MessageKey } from './translator.js';

const messages = {
  home: { title: 'Hello' },
  notes: { count: '{count, plural, =0 {No notes} one {# note} other {# notes}}' },
} as const;
const t = createTranslator(messages, 'en');

describe('createTranslator', () => {
  it('returns the message for a nested key', () => {
    expect(t('home.title')).toBe('Hello');
  });

  it('throws for a key that does not exist or points at a group', () => {
    expect(() => t('home.missing' as MessageKey<typeof messages>)).toThrow(
      'Missing message: home.missing',
    );
    expect(() => t('home' as MessageKey<typeof messages>)).toThrow('Missing message: home');
  });

  it('I18N-02.2 formats ICU plurals', () => {
    expect([0, 1, 2].map((count) => t('notes.count', { count }))).toEqual([
      'No notes',
      '1 note',
      '2 notes',
    ]);
  });
});
