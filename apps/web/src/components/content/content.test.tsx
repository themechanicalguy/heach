import { render, screen } from '@testing-library/react';
import { CATALOGUES } from '@heach/i18n';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ApiModule from '../../lib/api';
import { I18nProvider } from '../../lib/i18n-context';
import { ReferralView } from '../plans/ReferralView';
import { NotificationsView } from '../work/NotificationsView';
import { ContentPageView } from './ContentPageView';

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

beforeEach(() => {
  state.api.mockReset();
});

describe('Content edited by operations (AD-09) and provider referrals (RR-04)', () => {
  it('AD-09 a static page shows its paragraphs as plain text', async () => {
    state.api.mockResolvedValue({
      slug: 'faq',
      locale: 'en',
      title: 'Questions and answers',
      body: 'First paragraph.\n\n<b>Second</b> paragraph.',
      updatedAt: '2026-10-30T00:00:00.000Z',
    });
    inEnglish(<ContentPageView slug="faq" />);
    expect(await screen.findByRole('heading', { name: 'Questions and answers' })).toBeTruthy();
    expect(screen.getByText('<b>Second</b> paragraph.')).toBeTruthy();
    expect(state.api).toHaveBeenCalledWith('/pages/faq?locale=en');
  });

  it('AD-09 a page not yet written in this language says so', async () => {
    state.api.mockRejectedValue(new ApiModule.ApiError(404));
    inEnglish(<ContentPageView slug="terms" />);
    expect(await screen.findByText(CATALOGUES.en.pages.notFound)).toBeTruthy();
  });

  it('AD-09 an edited template wording is what the notification shows', async () => {
    state.api.mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith('/me/notifications')
          ? [
              {
                id: 'n1',
                template: 'plan_renewed',
                params: {},
                bookingId: null,
                createdAt: '2026-10-30T00:00:00.000Z',
                readAt: null,
                override: 'Your care plan is renewed. Thank you.',
              },
            ]
          : [],
      ),
    );
    inEnglish(<NotificationsView />);
    expect(await screen.findByText('Your care plan is renewed. Thank you.')).toBeTruthy();
  });

  it('RR-04 a provider sees the provider invitation and the commission discount left', async () => {
    state.api.mockResolvedValue({
      code: 'ABCD2345',
      invited: true,
      invitees: [],
      coupons: [],
      commissionCreditBookings: 9,
    });
    inEnglish(<ReferralView provider />);
    expect(await screen.findByText('Commission discount left on 9 bookings')).toBeTruthy();
    expect(screen.queryByText(CATALOGUES.en.referral.coupons)).toBeNull();
  });
});
