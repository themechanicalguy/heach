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
