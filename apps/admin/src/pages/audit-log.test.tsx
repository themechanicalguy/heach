import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../App';
import en from '../../messages/en.json';
import { AuditLog } from './AuditLog';

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
  vi.restoreAllMocks();
});

const entry = (seq: number, action: string) => ({
  seq: String(seq),
  id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
  at: '2026-11-10T10:00:00.000Z',
  actorId: `actor-${String(seq)}`,
  actorRole: 'verifier',
  action,
  entity: 'application',
  entityId: `entity-${String(seq)}`,
  correlationId: `corr-${String(seq)}`,
});

interface Call {
  route: string;
  query: URLSearchParams;
  authorization: string | null;
}

/** Answers the audit routes; `fresh` says whether a TOTP code was accepted. */
function serveAudit(pages: Record<string, unknown>) {
  const calls: Call[] = [];
  const state = { fresh: false };
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init?: RequestInit) => {
      const parsed = new URL(url, 'http://localhost');
      const route = `${init?.method ?? 'GET'} ${parsed.pathname.replace(/^\/api\/admin\/v1/, '')}`;
      const authorization = new Headers(init?.headers).get('authorization');
      calls.push({ route, query: parsed.searchParams, authorization });
      const reply = (status: number, body?: unknown) =>
        Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
      if (route === 'POST /auth/reverify') {
        state.fresh = true;
        return reply(204);
      }
      if (route === 'GET /audit/export') {
        if (!state.fresh) return reply(403, { code: 'reverification_required' });
        return Promise.resolve(new Response('seq,action\n1,a\n', { status: 200 }));
      }
      const page = pages[parsed.searchParams.get('before') ?? ''];
      return page ? reply(200, page) : reply(404, { code: 'not_found' });
    }),
  );
  return calls;
}

describe('Audit log page (AD-11)', () => {
  it('AD-11 lists entries as IDs and sends the filters on Search', async () => {
    const calls = serveAudit({ '': { entries: [entry(2, 'admin.login')], nextBefore: null } });
    render(<AuditLog />);
    const table = await screen.findByRole('table', { name: en.audit.caption });
    expect(within(table).getByText('admin.login')).toBeTruthy();
    expect(within(table).getByText('corr-2')).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.audit.loadMore })).toBeNull();

    fireEvent.change(screen.getByLabelText(en.audit.actorRole), { target: { value: 'verifier' } });
    fireEvent.change(screen.getByLabelText(en.audit.action), { target: { value: 'admin.' } });
    fireEvent.change(screen.getByLabelText(en.audit.from), { target: { value: '2026-11-01' } });
    fireEvent.change(screen.getByLabelText(en.audit.to), { target: { value: '2026-11-05' } });
    fireEvent.click(screen.getByRole('button', { name: en.audit.search }));
    await waitFor(() => {
      expect(calls.at(-1)?.query.get('actorRole')).toBe('verifier');
    });
    const query = calls.at(-1)?.query;
    expect(query?.get('action')).toBe('admin.');
    expect(query?.get('from')).toBe(new Date('2026-11-01T00:00:00').toISOString());
    expect(query?.get('to')).toBe(new Date('2026-11-05T23:59:59.999').toISOString());
    expect(query?.has('actorId')).toBe(false);
  });

  it('AD-11 Load more passes the cursor and appends the next page', async () => {
    const calls = serveAudit({
      '': { entries: [entry(3, 'first.page')], nextBefore: '3' },
      '3': { entries: [entry(2, 'second.page')], nextBefore: null },
    });
    render(<AuditLog />);
    fireEvent.click(await screen.findByRole('button', { name: en.audit.loadMore }));
    expect(await screen.findByText('second.page')).toBeTruthy();
    expect(screen.getByText('first.page')).toBeTruthy();
    expect(calls.at(-1)?.query.get('before')).toBe('3');
    expect(screen.queryByRole('button', { name: en.audit.loadMore })).toBeNull();
  });

  it('AD-11 shows an empty state and Clear removes the filters', async () => {
    const calls = serveAudit({ '': { entries: [], nextBefore: null } });
    render(<AuditLog />);
    expect(await screen.findByText(en.audit.none)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.audit.entity), { target: { value: 'booking' } });
    fireEvent.click(screen.getByRole('button', { name: en.audit.search }));
    await waitFor(() => {
      expect(calls.at(-1)?.query.get('entity')).toBe('booking');
    });
    fireEvent.click(screen.getByRole('button', { name: en.audit.clear }));
    await waitFor(() => {
      expect(calls.at(-1)?.query.has('entity')).toBe(false);
    });
    expect(screen.getByLabelText<HTMLInputElement>(en.audit.entity).value).toBe('');
  });

  it('AD-11 export asks for a fresh code, then downloads with the current filters', async () => {
    const calls = serveAudit({ '': { entries: [entry(1, 'x.y')], nextBefore: null } });
    const createUrl = vi.fn(() => 'blob:synthetic');
    const revokeUrl = vi.fn();
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    let downloaded: string | undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      downloaded = this.download;
    });
    render(<AuditLog />);
    await screen.findByRole('table');
    fireEvent.change(screen.getByLabelText(en.audit.entity), { target: { value: 'booking' } });
    fireEvent.click(screen.getByRole('button', { name: en.audit.search }));
    await waitFor(() => {
      expect(calls.at(-1)?.query.get('entity')).toBe('booking');
    });
    fireEvent.click(screen.getByRole('button', { name: en.audit.export }));
    expect(await screen.findByText(en.reverify.intro)).toBeTruthy();
    fireEvent.change(screen.getByLabelText(en.signIn.code), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: en.reverify.confirm }));
    await waitFor(() => {
      expect(downloaded).toBe('audit-log.csv');
    });
    expect(revokeUrl).toHaveBeenCalledWith('blob:synthetic');
    const exports = calls.filter((call) => call.route === 'GET /audit/export');
    expect(exports).toHaveLength(2);
    expect(exports.at(-1)?.query.get('entity')).toBe('booking');
    expect(exports.at(-1)?.query.has('before')).toBe(false);
  });
});

describe('Audit log section (AD-11)', () => {
  const serveSession = (role: string) => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const json = (body: unknown) =>
          Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
        if (url.endsWith('/auth/refresh')) return json({ accessToken: 'synthetic-token' });
        if (url.endsWith('/me')) return json({ email: 'admin@heach.invalid', role });
        if (url.endsWith('/dashboard')) {
          return json({
            signUps: 0,
            providersByRole: [],
            providersByDistrict: [],
            bookingsByService: [],
            bookingsByStatus: [],
            completionRate: 0,
            cancellationRate: 0,
            revenuePaise: 0,
          });
        }
        return json({ items: [], total: 0, page: 1, pageSize: 25, entries: [], nextBefore: null });
      }),
    );
  };

  it('AD-11 a super admin sees the section', async () => {
    serveSession('super_admin');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: en.nav.audit }));
    expect(await screen.findByRole('heading', { level: 1, name: en.audit.title })).toBeTruthy();
  });

  it('AD-11 support does not see the section', async () => {
    serveSession('support');
    render(<App />);
    expect(await screen.findByRole('navigation', { name: en.app.navLabel })).toBeTruthy();
    expect(screen.queryByRole('button', { name: en.nav.audit })).toBeNull();
  });
});
