import { PageMessages } from '../../../components/PageMessages';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedLinkView } from '../../../components/vault/SharePanels';
import { serverFlags } from '../../../lib/flags';

// Shared records are private: never indexed, never cached by a shared proxy (MV-09, MV-11).
// The link's token is its fragment, so the server never sees it.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function Page() {
  if (!serverFlags().isOn('accounts')) notFound();
  return (
    <PageMessages>
      <main className="page">
        <SharedLinkView />
      </main>
    </PageMessages>
  );
}
