import { notFound } from 'next/navigation';
import { BookingsPage } from '../../../components/account/AccountPages';
import { serverFlags } from '../../../lib/flags';

export default function Page() {
  if (!serverFlags().isOn('accounts')) notFound();
  return (
    <main className="page">
      <BookingsPage />
    </main>
  );
}
