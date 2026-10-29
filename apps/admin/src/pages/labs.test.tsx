import { render, screen } from '@testing-library/react';
import { Labs } from './Labs';
import en from '../../messages/en.json';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Labs (AD-13)', () => {
  it('AD-13 lists each lab with orders, turnaround and corrections', async () => {
    const row = {
      labId: 'l1',
      name: 'Synthetic Diagnostics',
      orders: 4,
      corrections: 1,
      todayCollections: 2,
      pendingReports: 1,
      averageTurnaroundHours: null,
      lateReports: 0,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify([row])))),
    );
    render(<Labs />);
    expect(await screen.findByText('Synthetic Diagnostics')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('AD-13 says when there is no lab yet', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('[]'))),
    );
    render(<Labs />);
    expect(await screen.findByText(en.labs.empty)).toBeTruthy();
  });
});
