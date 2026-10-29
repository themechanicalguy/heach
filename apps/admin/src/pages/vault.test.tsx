import { render, screen } from '@testing-library/react';
import { Vault } from './Vault';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Vault operations (AD-15)', () => {
  it('AD-15 shows counts and storage, no content', async () => {
    const stats = {
      records: 12,
      storageBytes: 2_097_152,
      infectedUploads: 1,
      activeShares: 3,
      activeLinks: 0,
      openDeletionRequests: 2,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(stats)))),
    );
    render(<Vault />);
    expect(await screen.findByText('2.0 MB')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });
});
