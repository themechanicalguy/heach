import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { IdentityReturnPage } from '../../../../../components/account/AccountPages';
import { serverFlags } from '../../../../../lib/flags';

export default function Page() {
  if (!serverFlags().isOn('accounts')) notFound();
  return (
    <main className="page">
      <Suspense>
        <IdentityReturnPage />
      </Suspense>
    </main>
  );
}
