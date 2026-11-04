import { createTranslator, LOCALES, type Messages } from '@heach/i18n';
import { keyFor, registerMessages } from './message-keys';
import { clientMessages, shellMessages } from './client-messages';

it('sends only shell copy and the requested client domains, with no legal bodies or static marketing prose', () => {
  const shell = shellMessages('en');
  expect(shell).not.toHaveProperty('sitePages');
  expect(shell).not.toHaveProperty('sms');
  expect(shell.site).not.toHaveProperty('intro');
  expect(Object.keys(clientMessages('en', 'home'))).toEqual(['search', 'bookings']);
  expect(clientMessages('or', 'provider')).toHaveProperty('application');
  expect(clientMessages('hi', 'pages')).toHaveProperty('pages');
  expect(clientMessages('en', 'pages')).not.toHaveProperty('sitePages');
});

it.each(LOCALES)('resolves notification templates from the actual %s client bundle', (locale) => {
  const messages = { ...shellMessages(locale), ...clientMessages(locale, 'notifications') };
  registerMessages(messages);
  const t = createTranslator(messages as Messages, locale);
  expect(keyFor('sms', 'booking_confirmed', 'notifications.title')).toBe('sms.booking_confirmed');
  expect(t('sms.booking_confirmed', { time: '10:00' })).not.toBe(t('notifications.title'));
  expect(keyFor('sms', 'unknown_template', 'notifications.title')).toBe('notifications.title');
});
