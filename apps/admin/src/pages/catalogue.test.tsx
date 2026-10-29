import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CatalogueItem, PinCode } from '@heach/types';
import { Catalogue } from './Catalogue';
import en from '../../messages/en.json';

const item: CatalogueItem = {
  code: 'nursing_injection',
  service: 'nursing',
  kind: 'visit',
  clinical: true,
  prescriptionRequired: true,
  durationMinutes: 30,
  sampleType: null,
  reportHours: null,
  name: 'Injection (IM, IV or SC)',
  preparation: null,
  active: true,
};
const pin: PinCode = { pin: '751001', district: 'Khordha', serviceable: true };

function stub() {
  const puts: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit = {}) => {
      const path = url.replace('/api/admin/v1', '');
      if (init.method === 'PUT') {
        puts.push({
          path,
          body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
        });
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      return Promise.resolve(new Response(JSON.stringify(path === '/catalogue' ? [item] : [pin])));
    }),
  );
  return puts;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Catalogue (AD-04, AD-08)', () => {
  it('AD-04 a super admin pauses an item and stops serving a PIN code', async () => {
    const puts = stub();
    render(<Catalogue canChange />);
    fireEvent.click(
      await screen.findByRole('button', { name: `${en.catalogue.pause} ${item.name}` }),
    );
    fireEvent.click(await screen.findByRole('button', { name: `${en.catalogue.stop} 751001` }));
    await waitFor(() => {
      expect(puts).toEqual([
        { path: '/catalogue/nursing_injection', body: { active: false } },
        { path: '/pins/751001', body: { serviceable: false } },
      ]);
    });
  });

  it('AD-04 support sees the catalogue without change buttons', async () => {
    stub();
    render(<Catalogue canChange={false} />);
    expect(await screen.findByText(item.name)).toBeTruthy();
    expect(screen.queryByRole('button', { name: new RegExp(en.catalogue.pause) })).toBeNull();
  });
});
