import { CATALOGUES } from '@heach/i18n';
import { ContentService } from './content.service.js';

const SLUGS = [
  'about',
  'verification',
  'areas',
  'contact',
  'grievance',
  'provider-agreement',
  'patient-rights',
] as const;

describe('AD-09 new public content pages', () => {
  it.each(['or', 'en', 'hi'] as const)(
    'has seven draft defaults in %s without a database seed',
    async (locale) => {
      const query = vi.fn().mockResolvedValue({ rows: [] });
      const content = new ContentService({ query });
      for (const slug of SLUGS) {
        expect(await content.page(slug, locale)).toMatchObject({
          slug,
          locale,
          ...CATALOGUES[locale].sitePages[slug],
          updatedAt: null,
        });
      }
      expect(await content.pages()).toHaveLength(33);
    },
  );
  it('gives saved operations content precedence over a draft', async () => {
    const saved = {
      slug: 'about',
      locale: 'en',
      title: 'Approved synthetic copy',
      body: 'Approved body',
      updatedAt: new Date(),
    };
    const content = new ContentService({ query: vi.fn().mockResolvedValue({ rows: [saved] }) });
    expect(await content.page('about', 'en')).toEqual(saved);
    expect(
      (await content.pages()).find((page) => page.slug === 'about' && page.locale === 'en'),
    ).toEqual(saved);
  });
});
