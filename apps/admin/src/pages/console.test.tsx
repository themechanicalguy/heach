import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Content } from './Content';
import { Dashboard } from './Dashboard';
import { Plans } from './Plans';
import { Referrals } from './Referrals';
import { Security } from './Security';
import { Settings } from './Settings';
import en from '../../messages/en.json';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Handler = (body: Record<string, unknown>) => [number, unknown?];

/** Answers `METHOD /path` (without the /api/admin/v1 prefix) and records every call. */
function serve(routes: Record<string, Handler>) {
  const calls: { route: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const path = new URL(url, 'http://localhost').pathname.replace(/^\/api\/admin\/v1/, '');
      const route = `${init?.method ?? 'GET'} ${path}`;
      const body = (init?.body ? JSON.parse(init.body as string) : {}) as Record<string, unknown>;
      calls.push({ route, body });
      const [status, payload] = routes[route]?.(body) ?? [404, { code: 'not_found' }];
      return Promise.resolve(
        new Response(payload === undefined ? null : JSON.stringify(payload), { status }),
      );
    }),
  );
  return calls;
}

const plan = {
  id: 'p1',
  kind: 'package',
  providerId: 'a1',
  providerName: 'Synthetic Physio',
  itemCode: 'physio_ortho_rehab',
  service: null,
  units: 10,
  discountPercent: 10,
  period: null,
  familyMembers: 0,
  validityDays: 60,
  pricePaise: 400_000,
  status: 'pending_approval',
  name: 'Ten physio sessions',
  inclusions: 'Ten home sessions',
  exclusions: 'Equipment',
};

describe('Dashboard and security console (AD-10, AD-17)', () => {
  it('AD-10 shows totals and rates without personal data', async () => {
    serve({
      'GET /dashboard': () => [
        200,
        {
          signUps: 12,
          providersByRole: [{ label: 'physiotherapist', count: 3 }],
          providersByDistrict: [],
          bookingsByService: [],
          bookingsByStatus: [{ label: 'completed', count: 4 }],
          completionRate: 0.8,
          cancellationRate: 0.1,
          revenuePaise: 120_000,
        },
      ],
    });
    render(<Dashboard />);
    expect(await screen.findByText('80%')).toBeTruthy();
    expect(screen.getByText('physiotherapist')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: en.dashboard.title })).toBeTruthy();
  });

  it('AD-17 lists open security items and break-glass grants', async () => {
    serve({
      'GET /security': () => [
        200,
        {
          breakGlass: [],
          openStrikeReviews: 2,
          flaggedReferrals: 1,
          infectedUploads: 0,
        },
      ],
    });
    render(<Security />);
    expect(await screen.findByText(en.security.none)).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});

describe('Settings (AD-08)', () => {
  it('AD-08 a change asks for a fresh code, then saves', async () => {
    let reverified = false;
    const calls = serve({
      'GET /settings': () => [200, [{ key: 'commission_bps', value: 1500 }]],
      'PUT /settings': () => (reverified ? [204] : [403, { code: 'reverification_required' }]),
      'POST /auth/reverify': (body) => {
        reverified = body.code === '123456';
        return reverified ? [204] : [401, { code: 'mfa_incorrect' }];
      },
    });
    render(<Settings canChange />);
    fireEvent.change(await screen.findByLabelText('commission_bps'), {
      target: { value: '1200' },
    });
    fireEvent.click(screen.getByRole('button', { name: `${en.settings.save} commission_bps` }));
    expect(await screen.findByText(en.reverify.intro)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.signIn.code), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: en.reverify.confirm }));
    expect(await screen.findByText(en.settings.saved)).toBeTruthy();
    expect(calls.filter((call) => call.route === 'PUT /settings').at(-1)?.body).toEqual({
      key: 'commission_bps',
      value: 1200,
    });
  });

  it('AD-08 changes a checklist item to optional; police verification stays required', async () => {
    const calls = serve({
      'GET /settings': () => [200, []],
      'GET /checklists': () => [
        200,
        [
          {
            role: 'nurse',
            items: [
              {
                key: 'qualification_certificate',
                required: true,
                reference: false,
                expiry: false,
                fixed: false,
              },
              {
                key: 'police_verification',
                required: true,
                reference: true,
                expiry: true,
                fixed: true,
              },
            ],
          },
        ],
      ],
      'PUT /checklists/nurse/qualification_certificate': () => [204],
    });
    render(<Settings canChange />);
    expect(await screen.findByText(en.checklists.fixed)).toBeTruthy();
    fireEvent.click(
      screen.getByRole('button', {
        name: `${en.checklists.makeOptional} nurse qualification_certificate`,
      }),
    );
    await waitFor(() => {
      expect(
        calls.find((call) => call.route === 'PUT /checklists/nurse/qualification_certificate')
          ?.body,
      ).toEqual({ required: false });
    });
  });

  it('AD-08 other sub-roles only read them', async () => {
    serve({ 'GET /settings': () => [200, [{ key: 'commission_bps', value: 1500 }]] });
    render(<Settings canChange={false} />);
    expect(await screen.findByText('1500')).toBeTruthy();
    expect(screen.getByText(en.settings.readOnly)).toBeTruthy();
  });
});

describe('Plans and referrals (PK-01, PK-02, RR-06, AD-14, AD-16)', () => {
  it('PK-02 approves a provider plan and creates a platform plan in three languages', async () => {
    const calls = serve({
      'GET /plans': () => [200, [plan]],
      'POST /plans/p1/approve': () => [204],
      'POST /plans': () => [201, { id: 'p2' }],
    });
    render(<Plans canChange />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.plans.approve} Ten physio sessions` }),
    );
    await waitFor(() => {
      expect(calls.some((call) => call.route === 'POST /plans/p1/approve')).toBe(true);
    });
    fireEvent.change(await screen.findByLabelText(en.plans.itemCode), {
      target: { value: 'nursing_wound_care' },
    });
    fireEvent.change(screen.getByLabelText(en.plans.rupees), { target: { value: '1500' } });
    for (const language of ['Odia', 'English', 'Hindi']) {
      for (const field of [en.plans.planName, en.plans.inclusions, en.plans.exclusions]) {
        fireEvent.change(screen.getByLabelText(`${field} (${language})`), {
          target: { value: `Synthetic ${language}` },
        });
      }
    }
    fireEvent.click(screen.getByRole('button', { name: en.plans.save }));
    expect(await screen.findByText(en.plans.created)).toBeTruthy();
    expect(calls.find((call) => call.route === 'POST /plans')?.body).toMatchObject({
      kind: 'package',
      itemCode: 'nursing_wound_care',
      pricePaise: 150_000,
      texts: { hi: { name: 'Synthetic Hindi' } },
    });
  });

  it('AD-14 lists purchases with renewal state and money, never the buyer', async () => {
    serve({
      'GET /plans': () => [200, []],
      'GET /plans/purchases': () => [
        200,
        [
          {
            id: 'pp1',
            planName: 'Monthly nursing',
            kind: 'subscription',
            status: 'active',
            renewal: true,
            autoRenew: false,
            renewalPaused: true,
            paidPaise: 200_000,
            refundedPaise: 0,
            createdAt: '2026-10-01T00:00:00Z',
            endsAt: '2026-11-01T00:00:00Z',
          },
        ],
      ],
    });
    render(<Plans canChange={false} />);
    expect(await screen.findByText('Monthly nursing')).toBeTruthy();
    expect(screen.getByText(en.plans.paused)).toBeTruthy();
  });

  it('RR-06 releases a flagged referral and cancels a coupon', async () => {
    const calls = serve({
      'GET /referrals': () => [
        200,
        [
          {
            id: 'r1',
            status: 'flagged',
            flagReason: 'same_device',
            createdAt: '2026-10-01T00:00:00Z',
          },
        ],
      ],
      'POST /referrals/r1/release': () => [204],
      'POST /coupons/c1/cancel': () => [204],
    });
    render(<Referrals />);
    expect(await screen.findByText('same_device')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `${en.referrals.release} r1` }));
    await waitFor(() => {
      expect(calls.some((call) => call.route === 'POST /referrals/r1/release')).toBe(true);
    });
    fireEvent.change(screen.getByLabelText(en.referrals.coupon), { target: { value: 'c1' } });
    fireEvent.click(screen.getByRole('button', { name: en.referrals.cancelCoupon }));
    expect(await screen.findByText(en.referrals.cancelled)).toBeTruthy();
  });
});

describe('Content (AD-09)', () => {
  it('AD-09 edits a template after a fresh code; support only reads', async () => {
    let reverified = false;
    const template = {
      template: 'plan_expiring',
      locale: 'en',
      defaultText: 'Your HEACH plan ends on {time}.',
      override: null,
      placeholders: ['time'],
    };
    const calls = serve({
      'GET /content/templates': () => [200, [template]],
      'GET /content/pages': () => [200, []],
      'PUT /content/templates/plan_expiring/en': () =>
        reverified ? [204] : [403, { code: 'reverification_required' }],
      'POST /auth/reverify': (body) => {
        reverified = body.code === '123456';
        return [204];
      },
    });
    const { unmount } = render(<Content canChange />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.content.edit} plan_expiring en` }),
    );
    fireEvent.change(screen.getByLabelText(/^plan_expiring/), {
      target: { value: 'Your care plan ends {time}.' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.content.save }));
    const sheet = within(await screen.findByRole('dialog'));
    fireEvent.change(sheet.getByLabelText(en.signIn.code), { target: { value: '123456' } });
    fireEvent.click(sheet.getByRole('button', { name: en.reverify.confirm }));
    expect(await screen.findByText(en.content.saved)).toBeTruthy();
    expect(calls.filter((call) => call.route.startsWith('PUT')).at(-1)?.body).toEqual({
      text: 'Your care plan ends {time}.',
    });
    unmount();
    render(<Content canChange={false} />);
    expect(await screen.findByText(en.content.readOnly)).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: `${en.content.edit} plan_expiring en` }),
    ).toBeNull();
  });
});
