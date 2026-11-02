import { CATALOGUES } from '@heach/i18n';
import { publicContent } from './public-content';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it('marks the catalogue fallback as an undated draft when the API is unavailable', async () => {
  vi.stubEnv('API_ORIGIN', 'https://api.invalid');
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Synthetic outage')));
  expect(await publicContent('about', 'or')).toEqual({
    slug: 'about',
    locale: 'or',
    ...CATALOGUES.or.sitePages.about,
    updatedAt: null,
  });
});

it('preserves the admin publication and its real update date from one server fetch', async () => {
  vi.stubEnv('API_ORIGIN', 'https://api.invalid');
  const page = {
    slug: 'about',
    locale: 'en',
    title: 'Approved synthetic copy',
    body: 'Approved body',
    updatedAt: '2026-10-30T00:00:00Z',
  };
  const fetcher = vi.fn().mockResolvedValue(Response.json(page));
  vi.stubGlobal('fetch', fetcher);
  expect(await publicContent('about', 'en')).toEqual(page);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
