import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { SearchView } from '../../../../components/care/SearchView';
import { isService } from '../../../../components/care/services';
import { serverFlags } from '../../../../lib/flags';

export default async function Page({ params }: Readonly<{ params: Promise<{ service: string }> }>) {
  const { service } = await params;
  if (!serverFlags().isOn('accounts') || !isService(service)) notFound();
  return (
    <main className="page">
      <Suspense>
        <SearchView service={service} />
      </Suspense>
    </main>
  );
}
