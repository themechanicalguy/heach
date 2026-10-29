import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Bookings } from './Bookings';
import { Finance } from './Finance';
import en from '../../messages/en.json';

const ID = '00000000-0000-4000-8000-0000000000ee';
const START = '2026-11-02T04:30:00.000Z';
const row = {
  id: ID,
  status: 'confirmed',
  itemName: 'Injection',
  startsAt: START,
  provider: { id: 'p', name: 'S•••••• N••••' },
  recipientName: 'S•••••• P••••',
  fees: { totalPaise: 35_000, paidPaise: 35_000 },
};
const detail = {
  ...row,
  events: [{ toStatus: 'confirmed', reason: null, actorRole: 'nurse', createdAt: START }],
  refunds: [{ amountPaise: 1_000, reason: 'goodwill', status: 'processed' }],
  payments: [{ purpose: 'booking', amountPaise: 35_000, status: 'paid' }],
};

function stub() {
  const posts: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const path = url.replace('/api/admin/v1', '');
      if (init.method === 'POST') {
        posts.push({
          path,
          body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
        });
        const result = path.endsWith('payout-runs')
          ? { id: 'r', runAt: START, providerCount: 2, totalPaise: 5_000 }
          : null;
        return Promise.resolve(
          new Response(result ? JSON.stringify(result) : null, { status: result ? 200 : 204 }),
        );
      }
      if (path.startsWith('/bookings/'))
        return Promise.resolve(new Response(JSON.stringify(detail)));
      if (path.startsWith('/bookings'))
        return Promise.resolve(
          new Response(JSON.stringify(path.includes('cancelled') ? [] : [row])),
        );
      return Promise.resolve(
        new Response(
          JSON.stringify({
            paidPaise: 35_000,
            refundedPaise: 1_000,
            commissionPaise: 4_500,
            commissionBps: 1500,
            runs: [],
          }),
        ),
      );
    }),
  );
  return posts;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Bookings console (AD-05, PY-02)', () => {
  it('AD-05 support filters, opens a booking, cancels and reassigns', async () => {
    const posts = stub();
    render(<Bookings role="support" />);
    fireEvent.click(await screen.findByRole('button', { name: `${en.bookings.open} ${ID}` }));
    expect(await screen.findByText(/booking: ₹350.00 paid/)).toBeTruthy();
    expect(screen.queryByLabelText(en.bookings.refund)).toBeNull();
    fireEvent.change(screen.getByLabelText(en.bookings.reassign), {
      target: { value: 'listing-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.bookings.doReassign }));
    expect(await screen.findByText(en.bookings.reassigned)).toBeTruthy();
    fireEvent.click(await screen.findByRole('button', { name: en.bookings.cancel }));
    await waitFor(() => {
      expect(posts.map((post) => post.path)).toEqual([
        `/bookings/${ID}/reassign`,
        `/bookings/${ID}/cancel`,
      ]);
    });
    fireEvent.change(screen.getByLabelText(en.bookings.filter), { target: { value: 'cancelled' } });
    expect(await screen.findByText(en.bookings.none)).toBeTruthy();
  });

  it('PY-02 finance issues a manual refund in paise and cannot cancel', async () => {
    const posts = stub();
    render(<Bookings role="finance" />);
    fireEvent.click(await screen.findByRole('button', { name: `${en.bookings.open} ${ID}` }));
    fireEvent.change(await screen.findByLabelText(en.bookings.refund), {
      target: { value: '12.50' },
    });
    fireEvent.click(screen.getByRole('button', { name: en.bookings.issueRefund }));
    await waitFor(() => {
      expect(posts).toEqual([
        { path: `/bookings/${ID}/refund`, body: { amountPaise: 1_250, reason: 'goodwill' } },
      ]);
    });
    expect(screen.queryByRole('button', { name: en.bookings.cancel })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: en.bookings.close }));
  });
});

describe('Finance (AD-07, PY-05)', () => {
  it('AD-07 shows totals and the commission rate, and runs payouts', async () => {
    stub();
    render(<Finance />);
    expect(await screen.findByText('Commission rate: 15%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.finance.runNow }));
    expect(await screen.findByText('Payout run finished: 2 providers.')).toBeTruthy();
    expect(screen.getByRole('link', { name: en.finance.export }).getAttribute('href')).toBe(
      '/api/admin/v1/finance/export.csv',
    );
  });
});
