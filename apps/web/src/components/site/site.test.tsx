import { ProviderJoin } from './ProviderJoin';
import { ServiceOverview } from './ServiceOverview';
import { SERVICES } from '../care/services';
import { CATALOGUES } from '@heach/i18n';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../lib/i18n-context';
import { HomeView } from './HomeView';
import { CareFinder } from './CareFinder';
import { NextBooking } from './NextBooking';
import { ContactAction } from './ContactAction';
import { PatientHome } from './PatientHome';
import { PublicHome } from './PublicHome';
import type { ReactNode } from 'react';

const state = vi.hoisted(() => ({
  status: 'signed-out',
  enabled: true,
  push: vi.fn(),
  setSearch: vi.fn(),
  person: '',
  search: { pin: '', q: '', service: 'physiotherapy' },
  rows: [] as unknown[],
}));
vi.mock('../../lib/session', () => ({ useSession: () => ({ status: state.status }) }));
vi.mock('../../lib/account', () => ({
  useAccount: () => ({
    enabled: state.enabled,
    account: { state: 'ready', me: { activeRole: 'patient' } },
  }),
}));
vi.mock('../../lib/care-search', () => ({
  useCareSearch: () => ({ search: state.search, setSearch: state.setSearch, person: state.person }),
}));
vi.mock('../../lib/use-resource', () => ({
  useResource: () => ({
    resource: { state: 'ready', data: state.rows },
    reload: () => Promise.resolve(),
  }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
const show = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );

beforeEach(() => {
  state.person = '';
  state.status = 'signed-out';
  state.enabled = true;
  state.rows = [];
  state.search = { pin: '', q: '', service: 'physiotherapy' };
  state.push.mockClear();
  state.setSearch.mockClear();
});
afterEach(cleanup);

it('renders the public home signed out, including when accounts are off', () => {
  state.enabled = false;
  show(
    <HomeView
      publicHome={<PublicHome config={{}} locale="en" />}
      patientHome={<PatientHome config={{}} locale="en" />}
    />,
  );
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(
    CATALOGUES.en.site.promise,
  );
  const emergency = screen.getByRole('region', { name: CATALOGUES.en.site.emergencyTitle });
  expect(emergency.textContent).toContain(CATALOGUES.en.site.emergencyBody);
  expect(
    screen.getByRole('link', { name: CATALOGUES.en.site.emergencyCall }).getAttribute('href'),
  ).toBe('tel:108');
});
it('shows a neutral shell while restoring the session, with marketing hidden', () => {
  state.status = 'checking';
  show(
    <HomeView
      publicHome={<PublicHome config={{}} locale="en" />}
      patientHome={<PatientHome config={{}} locale="en" />}
    />,
  );
  expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  expect(screen.getByText(CATALOGUES.en.site.promise).closest('[hidden]')).toBeTruthy();
});
it('mounts the patient home only after sign-in', () => {
  state.status = 'signed-in';
  show(
    <HomeView
      publicHome={<PublicHome config={{}} locale="en" />}
      patientHome={<PatientHome config={{}} locale="en" />}
    />,
  );
  expect(screen.getByRole('heading', { level: 1 }).textContent).toContain(CATALOGUES.en.site.need);
  expect(screen.getByRole('link', { name: /My records/ }).getAttribute('href')).toBe('/en/vault');
});
it('G02 puts the search and service tiles first, help and emergency in the side column', () => {
  state.status = 'signed-in';
  const { container } = show(<PatientHome config={{}} locale="en" />);
  const main = container.querySelector('.patient-home-main');
  const side = container.querySelector('.patient-home-side');
  expect(main?.querySelector('h1 + form[role="search"] + .service-tiles')).toBeTruthy();
  expect(side?.querySelector('.emergency + .support-card')).toBeTruthy();
  expect(main?.querySelector('.emergency, .next-booking')).toBeNull();
});
it('G03 colours tiles by meaning, not position: lavender services, a peach records well', () => {
  state.status = 'signed-in';
  const { container } = show(<PatientHome config={{}} locale="en" />);
  const wells = Array.from(container.querySelectorAll('.service-tile__icon')).map((well) =>
    well.className.replace('service-tile__icon ', ''),
  );
  expect(wells).toEqual([
    'service-tile__icon--lavender',
    'service-tile__icon--lavender',
    'service-tile__icon--lavender',
    'service-tile__icon--lavender',
    'service-tile__icon--peach',
  ]);
});
it('keeps doctor and clinic tiles absent with the flag off, and marketing numbers/reviews hidden', () => {
  show(<PublicHome config={{}} locale="en" />);
  const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
  expect(links.filter((href) => href?.startsWith('/en/services/'))).toHaveLength(4);
  expect(
    screen.queryByText(/Online doctor consultation|Dental and skin clinic|testimonials|as on/i),
  ).toBeNull();
});
it('uses a memory-only search and validates PIN codes before navigation', async () => {
  show(<CareFinder textSearch />);
  fireEvent.click(screen.getByRole('button', { name: CATALOGUES.en.site.find }));
  expect(screen.getByText(CATALOGUES.en.search.pinInvalid)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(CATALOGUES.en.search.pin), {
    target: { value: '751001' },
  });
  fireEvent.change(screen.getByLabelText(CATALOGUES.en.search.text), {
    target: { value: 'private care term' },
  });
  fireEvent.click(screen.getByRole('button', { name: CATALOGUES.en.site.find }));
  await waitFor(() => {
    expect(state.push).toHaveBeenCalledWith('/en/services/physiotherapy#find-care');
  });
  expect(state.setSearch).toHaveBeenCalledWith({
    pin: '751001',
    q: 'private care term',
    service: 'physiotherapy',
  });
});
it('shows no next-booking card without a booking, then the earliest future active booking', () => {
  const empty = show(<NextBooking />);
  expect(screen.queryByText(CATALOGUES.en.site.next)).toBeNull();
  empty.unmount();
  state.rows = [
    {
      id: 'late',
      startsAt: '2099-12-02T04:30:00Z',
      endsAt: '2099-12-02T05:30:00Z',
      status: 'confirmed',
      itemName: 'Synthetic home visit',
      provider: { name: 'Synthetic Nurse' },
    },
    {
      id: 'next',
      startsAt: '2099-12-01T04:30:00Z',
      endsAt: '2099-12-01T05:30:00Z',
      status: 'confirmed',
      itemName: 'Synthetic physiotherapy',
      provider: { name: 'Synthetic Physio' },
    },
    {
      id: 'cancelled',
      startsAt: '2099-11-01T04:30:00Z',
      endsAt: '2099-11-01T05:30:00Z',
      status: 'cancelled',
    },
  ];
  show(<NextBooking />);
  expect(screen.getByRole('link', { name: CATALOGUES.en.site.details }).getAttribute('href')).toBe(
    '/en/bookings/next',
  );
});
it.each([
  ['pending_payment', 'visit', CATALOGUES.en.site.payNow, '/en/bookings/next'],
  ['confirmed', 'visit', CATALOGUES.en.visit.showCode, '/en/bookings/next#start-code'],
  ['in_progress', 'shift', CATALOGUES.en.visit.showCode, '/en/bookings/next#start-code'],
])('G04 a %s %s booking leads with its next step, Details second', (status, kind, label, href) => {
  state.rows = [
    {
      id: 'next',
      startsAt: '2099-12-01T04:30:00Z',
      endsAt: '2099-12-01T05:30:00Z',
      status,
      kind,
      itemName: 'Synthetic visit',
      provider: { name: 'Synthetic Nurse' },
    },
  ];
  show(<NextBooking />);
  const links = screen.getAllByRole('link');
  expect(links.map((link) => link.textContent)).toEqual([label, CATALOGUES.en.site.details]);
  expect(links[0]?.getAttribute('href')).toBe(href);
  expect(screen.queryByText(/join|video/i)).toBeNull();
});
it.each([
  ['requested', 'visit'],
  ['confirmed', 'lab_test'],
])('G04 a %s %s booking states its status and offers only Details', (status, kind) => {
  state.rows = [
    {
      id: 'next',
      startsAt: '2099-12-01T04:30:00Z',
      endsAt: '2099-12-01T05:30:00Z',
      status,
      kind,
      itemName: 'Synthetic visit',
      provider: null,
    },
  ];
  show(<NextBooking />);
  expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
    CATALOGUES.en.site.details,
  ]);
  expect(screen.getByText(CATALOGUES.en.bookings.status[status as 'requested'])).toBeTruthy();
});
it('uses only the configured helpline and otherwise explains that it is pending', () => {
  const empty = show(<ContactAction locale="en" config={{}} />);
  expect(screen.getByRole('link').getAttribute('href')).toBe('/en/pages/contact');
  empty.unmount();
  show(<ContactAction locale="en" config={{ helpline: '1800000000' }} />);
  expect(screen.getByRole('link').getAttribute('href')).toBe('tel:1800000000');
});

it.each(['or', 'en', 'hi'] as const)('shows service-specific FAQs in %s', (locale) => {
  for (const service of SERVICES) {
    const view = render(
      <I18nProvider locale={locale} messages={CATALOGUES[locale]}>
        <ServiceOverview locale={locale} service={service} accounts={false} />
      </I18nProvider>,
    );
    expect(
      screen.getByText(CATALOGUES[locale].serviceDetails[service].faq['0'].question),
    ).toBeTruthy();
    expect(screen.queryByText(CATALOGUES[locale].siteFaq['0'].question)).toBeNull();
    view.unmount();
  }
});

it('keeps an in-progress care query when the saved PIN arrives, and clears it for another person', () => {
  const view = show(<CareFinder textSearch />);
  fireEvent.change(screen.getByLabelText(CATALOGUES.en.search.text), {
    target: { value: 'Synthetic private intent' },
  });
  state.search = { pin: '751001', q: '', service: 'physiotherapy' };
  const finder = () => (
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      <CareFinder textSearch />
    </I18nProvider>
  );
  view.rerender(finder());
  expect(screen.getByLabelText<HTMLInputElement>(CATALOGUES.en.search.text).value).toBe(
    'Synthetic private intent',
  );
  state.person = 'synthetic-parent';
  state.search = { pin: '', q: '', service: 'physiotherapy' };
  view.rerender(finder());
  expect(screen.getByLabelText<HTMLInputElement>(CATALOGUES.en.search.text).value).toBe('');
});

const ODIA_SCRIPT = /[଀-୿]/;
it.each(['en', 'hi'] as const)(
  'I18N-01 shows only the selected language, never Odia, on %s site pages',
  (locale) => {
    const pages = [
      <PublicHome key="public" config={{}} locale={locale} />,
      <PatientHome key="patient" config={{}} locale={locale} />,
      <ProviderJoin key="join" accounts locale={locale} />,
      ...SERVICES.map((service) => (
        <ServiceOverview key={service} service={service} accounts locale={locale} />
      )),
    ];
    for (const page of pages) {
      const { container, unmount } = render(
        <I18nProvider locale={locale} messages={CATALOGUES[locale]}>
          {page}
        </I18nProvider>,
      );
      expect(container.textContent).not.toMatch(ODIA_SCRIPT);
      expect(container.querySelector('h1')?.textContent).toBeTruthy();
      unmount();
    }
  },
);
