import { PageMessages } from '../../../components/PageMessages';
import { notFound } from 'next/navigation';
import { ProviderPage } from '../../../components/account/ProviderPage';
import { serverFlags } from '../../../lib/flags';

export default function Page() {
  if (!serverFlags().isOn('accounts')) notFound();
  return (
    <PageMessages>
      <main className="page page--app">
        <ProviderPage />
      </main>
    </PageMessages>
  );
}
