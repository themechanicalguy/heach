import { PageMessages } from '../../../components/PageMessages';
import { notFound } from 'next/navigation';
import { ConsentPage } from '../../../components/account/AccountPages';
import { serverFlags } from '../../../lib/flags';

export default function Page() {
  if (!serverFlags().isOn('accounts')) notFound();
  return (
    <PageMessages>
      <main className="page">
        <ConsentPage />
      </main>
    </PageMessages>
  );
}
