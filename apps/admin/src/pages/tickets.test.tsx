import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Reviews } from './Reviews';
import { Tickets } from './Tickets';
import en from '../../messages/en.json';

const START = '2026-11-02T04:30:00.000Z';
const ticket = {
  id: 't1',
  bookingId: 'b1',
  kind: 'safety',
  priority: 'p0',
  topic: 'safety_threat',
  status: 'open',
  resolution: null,
  raisedByRole: 'patient',
  createdAt: START,
  updatedAt: START,
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
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (path.endsWith('/restricted')) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              description: 'Synthetic concern',
              notes: ['Called'],
              grantExpiresAt: START,
            }),
          ),
        );
      }
      if (path.startsWith('/reviews')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              {
                id: 'r1',
                stars: 1,
                comment: 'Synthetic',
                createdAt: START,
                providerId: 'p',
                reported: true,
                hidden: false,
                hiddenReason: null,
              },
            ]),
          ),
        );
      }
      return Promise.resolve(new Response(JSON.stringify([ticket])));
    }),
  );
  return posts;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Tickets and reviews (AD-06, SE-03, RF-02)', () => {
  it('SE-03 break-glass with a reason opens the private text; assign, note and resolve', async () => {
    const posts = stub();
    render(<Tickets />);
    fireEvent.click(await screen.findByRole('button', { name: `${en.tickets.open} t1` }));
    fireEvent.click(screen.getByRole('button', { name: en.tickets.breakGlass }));
    expect(await screen.findByText('Synthetic concern')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: en.tickets.assign }));
    fireEvent.change(screen.getByLabelText(en.tickets.note), { target: { value: 'Followed up' } });
    await waitFor(() => {
      expect(
        screen.getByRole<HTMLButtonElement>('button', { name: en.tickets.addNote }).disabled,
      ).toBe(false);
    });
    fireEvent.click(screen.getByRole('button', { name: en.tickets.addNote }));
    fireEvent.click(await screen.findByRole('button', { name: en.tickets.resolve }));
    await waitFor(() => {
      expect(posts.map((post) => post.path)).toEqual([
        '/tickets/t1/break-glass',
        '/tickets/t1/assign',
        '/tickets/t1/notes',
        '/tickets/t1/resolve',
      ]);
    });
    expect(posts[0]?.body).toEqual({ reason: 'safety_investigation' });
  });

  it('RF-02 hides a reported review with a reason', async () => {
    const posts = stub();
    render(<Reviews />);
    fireEvent.change(await screen.findByLabelText(en.reviews.reason), {
      target: { value: 'fake' },
    });
    fireEvent.click(screen.getByRole('button', { name: `${en.reviews.hide} r1` }));
    await waitFor(() => {
      expect(posts).toEqual([{ path: '/reviews/r1/hide', body: { reason: 'fake' } }]);
    });
  });
});
