import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SharedLinkView } from '../../../../components/vault/SharePanels';
import { serverFlags } from '../../../../lib/flags';

// Shared records are private: never indexed, never cached by a shared proxy (MV-09, MV-11).
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Page({ params }: Readonly<{ params: Promise<{ token: string }> }>) {
  const { token } = await params;
  if (!serverFlags().isOn('accounts') || !/^[\w-]{20,64}$/.test(token)) notFound();
  return (
    <main className="page">
      <SharedLinkView token={token} />
    </main>
  );
}
