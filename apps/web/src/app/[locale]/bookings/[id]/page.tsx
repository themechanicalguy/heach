import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { BookingPage } from '../../../../components/account/AccountPages';
import { serverFlags } from '../../../../lib/flags';

const PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export default async function Page({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  if (!serverFlags().isOn('accounts') || !PATTERN.test(id)) notFound();
  const page = <BookingPage bookingId={id} />;
  return <main className="page">{<Suspense>{page}</Suspense>}</main>;
}
