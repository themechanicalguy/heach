import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProviderProfileView } from '../../../../components/care/ProviderProfileView';
import { serverFlags } from '../../../../lib/flags';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!serverFlags().isOn('accounts') || !UUID.test(id)) notFound();
  return (
    <main className="page">
      <Suspense>
        <ProviderProfileView providerId={id} />
      </Suspense>
    </main>
  );
}
