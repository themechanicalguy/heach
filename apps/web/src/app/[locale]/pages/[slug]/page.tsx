import { PageMessages } from '../../../../components/PageMessages';
import { notFound } from 'next/navigation';
import { PAGE_SLUGS } from '@heach/i18n';
import { CoverageCheck } from '../../../../components/site/CoverageCheck';
import { ContactPage } from '../../../../components/site/ContactPage';
import { EmergencyBanner } from '../../../../components/site/EmergencyBanner';
import { ContentPageView } from '../../../../components/content/ContentPageView';
import { translatorFor } from '../../../../i18n/messages';
import { publicContent } from '../../../../lib/public-content';
import { siteConfig } from '../../../../lib/site-config';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ slug: string; locale: string }> }>) {
  const { slug, locale: requested } = await params;
  if (!(PAGE_SLUGS as readonly string[]).includes(slug)) notFound();
  const { locale } = translatorFor(requested);
  const initial = await publicContent(slug as (typeof PAGE_SLUGS)[number], locale);
  return (
    <PageMessages page={slug === 'areas' ? 'areas' : 'pages'}>
      <main className="page">
        {slug === 'contact' && <EmergencyBanner locale={locale} />}
        <ContentPageView slug={slug} initial={initial} />
        {slug === 'areas' && <CoverageCheck />}
        {slug === 'contact' && <ContactPage config={siteConfig()} locale={locale} />}
      </main>
    </PageMessages>
  );
}
