import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CATALOGUES } from '@heach/i18n';
import type { Plan, Purchase } from '@heach/types';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { PaymentOptions } from '../booking/PaymentOptions';
import { PlansView } from './PlansView';
import { ReferralView } from './ReferralView';

const state = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock('../../lib/api', async (original) => ({
  ...(await original<typeof ApiModule>()),
  api: state.api,
}));

const inEnglish = (node: ReactNode) =>
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      {node}
    </I18nProvider>,
  );
const END = '2026-12-30T04:30:00.000Z';
const plan: Plan = {
  id: 'p1',
  kind: 'package',
  providerId: null,
  providerName: null,
  itemCode: 'physio_ortho_rehab',
  service: null,
  units: 10,
  discountPercent: 10,
  period: null,
  familyMembers: 2,
  validityDays: 60,
  pricePaise: 400_000,
  status: 'active',
  name: 'Ten physio sessions',
  inclusions: 'Ten home sessions',
  exclusions: 'Equipment',
};
const purchase: Purchase = {
  id: 'pp1',
  planId: 'p1',
  name: 'Ten physio sessions',
  kind: 'subscription',
  status: 'active',
  autoRenew: false,
  renewalPaused: false,
  pricePaise: 400_000,
  paidPaise: 400_000,
  refundedPaise: 0,
  endsAt: END,
  entitlements: [
    { id: 'e1', itemCode: 'physio_ortho_rehab', service: null, unitsTotal: 10, unitsUsed: 3 },
  ],
  refundIfCancelledPaise: 280_000,
};

function route(responses: Record<string, unknown>) {
  state.api.mockImplementation((path: string, init?: RequestInit) => {
    const key = Object.keys(responses).find((prefix) => path.startsWith(prefix));
    if (key) return Promise.resolve(responses[key]);
    return Promise.resolve(init?.method ? undefined : []);
  });
}
const posted = (path: string) =>
  (state.api.mock.calls as [string, RequestInit | undefined][]).find(
    ([called, init]) => called === path && init?.method === 'POST',
  );

beforeEach(() => {
  state.api.mockReset();
});

describe('Plans on the web (PK-01 to PK-07)', () => {
  it('PK-03 shows the terms before buying; buying pays through the sandbox', async () => {
    route({
      '/plans/p1/purchase': {
        purchaseId: 'pp2',
        orderId: 'order_p',
        amountPaise: 400_000,
        sandbox: true,
      },
      '/plans': [plan],
      '/me/plans': [],
    });
    inEnglish(<PlansView />);
    expect(await screen.findByText('Includes: Ten home sessions')).toBeTruthy();
    expect(screen.getByText('Does not include: Equipment')).toBeTruthy();
    expect(screen.getByText('Covers 2 family members')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Buy for ₹4,000.00' }));
    await waitFor(() => {
      expect(posted('/payments/sandbox/order_p/pay')).toBeTruthy();
    });
  });

  it('PK-04 PK-06 PK-07 my plan shows what is left, toggles renewal and cancels with the refund shown', async () => {
    route({ '/me/plans': [purchase], '/plans': [] });
    inEnglish(<PlansView />);
    expect(await screen.findByText('7 of 10 left')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Renew automatically'));
    await waitFor(() => {
      expect(JSON.parse(posted('/me/plans/pp1/auto-renew')?.[1]?.body as string)).toEqual({
        enabled: true,
      });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel plan' }));
    expect(screen.getByText('Cancelling now refunds ₹2,800.00.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel plan' }));
    await waitFor(() => {
      expect(posted('/me/plans/pp1/cancel')).toBeTruthy();
    });
  });
});

describe('Referrals and payment options (RR-01, RR-07, RR-08, BK-08)', () => {
  it('RR-01 shows the code, share links, invitees and coupons; joins with a code', async () => {
    route({
      '/me/referral': {
        code: 'ABCD2345',
        invited: false,
        invitees: [{ status: 'rewarded', joinedAt: END }],
        coupons: [{ id: 'c1', valuePaise: 10_000, expiresAt: END, status: 'active' }],
      },
    });
    inEnglish(<ReferralView />);
    expect(await screen.findByText('Your code: ABCD2345')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Share on WhatsApp' }).getAttribute('href')).toContain(
      'https://wa.me/?text=',
    );
    expect(screen.getByText(/Completed a booking/)).toBeTruthy();
    expect(screen.getByText(/₹100.00 off/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Were you invited? Enter their code' }), {
      target: { value: 'wxyz2345' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use code' }));
    await waitFor(() => {
      expect(JSON.parse(posted('/me/referral/join')?.[1]?.body as string)).toEqual({
        code: 'WXYZ2345',
      });
    });
  });

  it('BK-08 offers active plans and coupons at checkout', async () => {
    route({
      '/me/plans': [purchase],
      '/me/referral': {
        code: 'ABCD2345',
        invited: true,
        invitees: [],
        coupons: [{ id: 'c1', valuePaise: 5_000, expiresAt: END, status: 'active' }],
      },
    });
    const onPurchase = vi.fn();
    const onCoupon = vi.fn();
    inEnglish(
      <PaymentOptions purchaseId="" couponId="" onPurchase={onPurchase} onCoupon={onCoupon} />,
    );
    fireEvent.change(await screen.findByLabelText('Pay with my plan'), {
      target: { value: 'pp1' },
    });
    fireEvent.change(await screen.findByLabelText('Apply a coupon'), { target: { value: 'c1' } });
    expect(onPurchase).toHaveBeenCalledWith('pp1');
    expect(onCoupon).toHaveBeenCalledWith('c1');
  });
});
