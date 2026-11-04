import { CATALOGUES } from '@heach/i18n';
import { cleanup, render, screen, within } from '@testing-library/react';
import { expectNoAxeViolations } from '../../../../../packages/ui/src/test/axe';
import { ContactPage } from './ContactPage';
import { SYNTHETIC_CONTACT } from './contact-fixture';

const en = CATALOGUES.en;
afterEach(cleanup);

const hrefOf = (name: string) => screen.getByRole('link', { name }).getAttribute('href');

it('routes each need to the place it is solved, under the page locale', () => {
  render(<ContactPage locale="or" config={{}} />);
  const or = CATALOGUES.or.contact.routes;
  expect(hrefOf(`${or.booking.title} ${or.booking.body}`)).toBe('/or/bookings');
  expect(hrefOf(`${or.refund.title} ${or.refund.body}`)).toBe('/or/pages/refunds');
  expect(hrefOf(`${or.data.title} ${or.data.body}`)).toBe('/or/account');
  expect(hrefOf(`${or.other.title} ${or.other.body}`)).toBe('#contact-channels');
});

it('marks every unconfirmed detail as pending and offers no contact links', async () => {
  const { container } = render(<ContactPage locale="en" config={{}} />);
  for (const text of [
    en.contact.channelsPending,
    en.contact.grievancePending,
    en.contact.dataPending,
    en.site.legalPending,
  ]) {
    expect(screen.getByText(text)).toBeTruthy();
  }
  expect(container.querySelector('a[href^="tel:"], a[href^="mailto:"]')).toBeNull();
  await expectNoAxeViolations(container);
});

it('shows confirmed channels, grievance officer, data contact and company', async () => {
  const { container } = render(<ContactPage locale="en" config={SYNTHETIC_CONTACT} />);
  expect(hrefOf(`${en.site.call} 1800-000-0000`)).toBe('tel:1800-000-0000');
  expect(screen.getByText('08:00 to 20:00, every day')).toBeTruthy();
  expect(screen.getByText('Odia · English · Hindi')).toBeTruthy();
  expect(screen.getByText('We reply within 1 working day.')).toBeTruthy();
  const grievance = within(screen.getByRole('region', { name: en.contact.grievanceTitle }));
  expect(grievance.getByText('Synthetic Officer')).toBeTruthy();
  expect(grievance.getByText(en.contact.designationValue)).toBeTruthy();
  expect(
    grievance.getByText(
      'We acknowledge your complaint within 24 hours and resolve it within 15 days.',
    ),
  ).toBeTruthy();
  expect(hrefOf('privacy@heach.example')).toBe('mailto:privacy@heach.example');
  expect(screen.getByText('U00000OD0000PTC000000')).toBeTruthy();
  expect(hrefOf(en.contact.maps)).toContain('maps/search/?api=1&query=Plot%200');
  await expectNoAxeViolations(container);
});

it('hides hours and reply time that have nothing to attach to', () => {
  const { helplineHours, replyDays } = SYNTHETIC_CONTACT;
  render(<ContactPage locale="en" config={{ helplineHours, replyDays }} />);
  expect(screen.queryByText(en.contact.hours)).toBeNull();
  expect(screen.queryByText('We reply within 1 working day.')).toBeNull();
  expect(screen.getByText(en.contact.channelsPending)).toBeTruthy();
});
