import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ApplicationSummary } from '@heach/types';
import { Applications } from './Applications';
import en from '../../messages/en.json';

const NURSE: ApplicationSummary = {
  accountId: '00000000-0000-4000-8000-0000000000b1',
  role: 'nurse',
  status: 'submitted',
  fullName: 'Synthetic Nurse',
  submittedAt: '2026-11-09T00:00:00Z',
  ageDays: 4,
  assisted: false,
  assistedByYou: false,
};
const LAB: ApplicationSummary = {
  ...NURSE,
  accountId: '00000000-0000-4000-8000-0000000000b2',
  role: 'lab',
  fullName: 'Synthetic Lab',
  ageDays: 0,
};

/** A queue that answers each filter the way the API does, and records the paths asked. */
function stubQueue() {
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      const path = url.replace('/api/admin/v1', '');
      paths.push(path);
      const params = new URL(path, 'http://localhost').searchParams;
      const rows = [NURSE, LAB]
        .filter((row) => !params.get('role') || row.role === params.get('role'))
        .filter((row) => params.get('age') !== 'gt3' || (row.ageDays ?? 0) >= 3);
      return Promise.resolve(new Response(JSON.stringify(rows)));
    }),
  );
  return paths;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Verification queue filters (AD-02)', () => {
  it('AD-02 shows how long each application has waited', async () => {
    stubQueue();
    render(<Applications />);
    expect(await screen.findByText('Synthetic Nurse')).toBeTruthy();
    expect(screen.getByText('4 days')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
  });

  it('AD-02 the provider type filter sends role and narrows the list', async () => {
    const paths = stubQueue();
    render(<Applications />);
    await screen.findByText('Synthetic Lab');
    fireEvent.change(screen.getByLabelText(en.verification.filterRole), {
      target: { value: 'lab' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Synthetic Nurse')).toBeNull();
    });
    expect(screen.getByText('Synthetic Lab')).toBeTruthy();
    expect(paths.at(-1)).toBe('/applications?view=open&role=lab');
  });

  it('AD-02 the waiting-time filter sends age; filters combine and clear', async () => {
    const paths = stubQueue();
    render(<Applications />);
    await screen.findByText('Synthetic Lab');
    fireEvent.change(screen.getByLabelText(en.verification.filterAge), {
      target: { value: 'gt3' },
    });
    await waitFor(() => {
      expect(screen.queryByText('Synthetic Lab')).toBeNull();
    });
    expect(paths.at(-1)).toBe('/applications?view=open&age=gt3');
    fireEvent.change(screen.getByLabelText(en.verification.filterRole), {
      target: { value: 'nurse' },
    });
    await waitFor(() => {
      expect(paths.at(-1)).toBe('/applications?view=open&role=nurse&age=gt3');
    });
    fireEvent.change(screen.getByLabelText(en.verification.filterAge), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText(en.verification.filterRole), { target: { value: '' } });
    expect(await screen.findByText('Synthetic Lab')).toBeTruthy();
    expect(paths.at(-1)).toBe('/applications?view=open');
  });

  it('AD-02 the filters apply to the decided view too', async () => {
    const paths = stubQueue();
    render(<Applications />);
    await screen.findByText('Synthetic Lab');
    fireEvent.change(screen.getByLabelText(en.verification.filterRole), {
      target: { value: 'lab' },
    });
    fireEvent.click(screen.getByLabelText(en.verification.viewDecided));
    await waitFor(() => {
      expect(paths.at(-1)).toBe('/applications?view=decided&role=lab');
    });
  });
});
