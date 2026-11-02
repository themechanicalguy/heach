import { act, fireEvent, render, screen } from '@testing-library/react';
import { CATALOGUES } from '@heach/i18n';
import { I18nProvider } from '../../lib/i18n-context';
import { api } from '../../lib/api';
import { CoverageCheck } from './CoverageCheck';
vi.mock('../../lib/api', () => ({ api: vi.fn() }));

it('checks coverage by POST and discards results if the PIN is changed during the request', async () => {
  let finish: (data: unknown) => void = vi.fn<(data: unknown) => void>();
  vi.mocked(api).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  render(
    <I18nProvider locale="en" messages={CATALOGUES.en}>
      <CoverageCheck />
    </I18nProvider>,
  );
  const input = screen.getByLabelText(CATALOGUES.en.search.pin);
  fireEvent.change(input, { target: { value: '751001' } });
  fireEvent.click(screen.getByRole('button', { name: CATALOGUES.en.site.checkCoverage }));
  expect(api).toHaveBeenCalledWith('/coverage', { method: 'POST', body: '{"pin":"751001"}' });
  fireEvent.change(input, { target: { value: '753001' } });
  await act(async () => {
    finish({ served: true, services: ['nursing'] });
    await Promise.resolve();
  });
  expect(screen.queryByText(CATALOGUES.en.site.coverageServed)).toBeNull();
});
