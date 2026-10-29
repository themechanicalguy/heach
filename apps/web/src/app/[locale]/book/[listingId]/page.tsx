import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookChosenPage } from '../../../../components/account/AccountPages';
import { serverFlags } from '../../../../lib/flags';

const PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export default async function Page({
  params,
}: Readonly<{ params: Promise<{ listingId: string }> }>) {
  const { listingId } = await params;
  if (!serverFlags().isOn('accounts') || !PATTERN.test(listingId)) notFound();
  const page = <BookChosenPage listingId={listingId} />;
  return <main className="page">{<Suspense>{page}</Suspense>}</main>;
}
