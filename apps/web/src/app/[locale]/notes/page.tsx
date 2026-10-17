import { notFound } from 'next/navigation';
import { NotesView } from '../../../components/NotesView';
import { translatorFor } from '../../../i18n/messages';
import { serverFlags } from '../../../lib/flags';

/** Sample patient note: exists only where `sample-patient-note` is on (dev and test). */
export default async function NotesPage({
  params,
}: Readonly<{ params: Promise<{ locale: string }> }>) {
  if (!serverFlags().isOn('sample-patient-note')) notFound();
  const { t } = translatorFor((await params).locale);
  return (
    <main className="page">
      <h1>{t('sample.note.title')}</h1>
      <NotesView />
    </main>
  );
}
