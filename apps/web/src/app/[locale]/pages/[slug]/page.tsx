import { notFound } from 'next/navigation';
import { ContentPageView, PAGE_SLUGS } from '../../../../components/content/ContentPageView';

export default async function Page({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  if (!(PAGE_SLUGS as readonly string[]).includes(slug)) notFound();
  return (
    <main className="page">
      <ContentPageView slug={slug} />
    </main>
  );
}
