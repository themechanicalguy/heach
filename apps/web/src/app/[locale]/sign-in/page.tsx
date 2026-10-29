import { notFound } from 'next/navigation';
import { SignInFlow } from '../../../components/account/SignInFlow';
import { TestSignIn } from '../../../components/TestSignIn';
import { serverFlags } from '../../../lib/flags';
import { safeNext } from '../../../lib/routing';

interface Props {
  searchParams: Promise<{ next?: string | string[] }>;
}

/**
 * OTP sign-in where accounts are on; the Step 2 test sign-in only where the sample flag is on,
 * which is local, test and dev only (SE-07.4).
 */
export default async function SignInPage({ searchParams }: Readonly<Props>) {
  const flags = serverFlags();
  const accounts = flags.isOn('accounts');
  const testSignIn = flags.isOn('sample-patient-note');
  if (!accounts && !testSignIn) notFound();
  const { next } = await searchParams;
  return (
    <main className="page">
      {accounts && <SignInFlow next={safeNext(typeof next === 'string' ? next : undefined)} />}
      {testSignIn && <TestSignIn />}
    </main>
  );
}
