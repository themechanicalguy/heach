import { createTranslator, type MessageKey } from './translator.js';

const messages = { home: { title: 'Hello' }, empty: {} } as const;
const t = createTranslator(messages);

describe('createTranslator', () => {
  it('returns the message for a nested key', () => {
    expect(t('home.title')).toBe('Hello');
  });

  it('throws for a key that does not exist', () => {
    const missing = 'home.missing' as MessageKey<typeof messages>;
    expect(() => t(missing)).toThrow('Missing message: home.missing');
  });

  it('throws when the key points at a group, not a string', () => {
    const group = 'home' as MessageKey<typeof messages>;
    expect(() => t(group)).toThrow('Missing message: home');
  });
});
