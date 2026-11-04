import { PageMessages } from '../../../../../components/PageMessages';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookAnyPage } from '../../../../../components/account/AccountPages';
import { serverFlags } from '../../../../../lib/flags';

const PATTERN = /^[a-z0-9_]{2,60}$/;

export default async function Page({ params }: Readonly<{ params: Promise<{ item: string }> }>) {
  const { item } = await params;
  if (!serverFlags().isOn('accounts') || !PATTERN.test(item)) notFound();
  const page = <BookAnyPage itemCode={item} />;
  return (
    <PageMessages>
      {<main className="page page--app">{<Suspense>{page}</Suspense>}</main>}
    </PageMessages>
  );
}
