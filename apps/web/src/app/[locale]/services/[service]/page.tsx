import { PageMessages } from '../../../../components/PageMessages';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SearchView } from '../../../../components/care/SearchView';
import { isService } from '../../../../components/care/services';
import { ServiceOverview } from '../../../../components/site/ServiceOverview';
import { publicPrices } from '../../../../lib/public-content';
import { serverFlags } from '../../../../lib/flags';

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ service: string; locale: string }> }>) {
  const { service, locale } = await params;
  if (!isService(service)) notFound();
  const prices = await publicPrices();
  const accounts = serverFlags().isOn('accounts');
  return (
    <PageMessages>
      <main className="page site-home">
        <ServiceOverview prices={prices} locale={locale} service={service} accounts={accounts} />
        {accounts && (
          <Suspense>
            <SearchView service={service} />
          </Suspense>
        )}
      </main>
    </PageMessages>
  );
}
