import { notFound } from 'next/navigation';
import { TestSignIn } from '../../../components/TestSignIn';
import { serverFlags } from '../../../lib/flags';

/** Test sign-in: only where the sample flag is on, which is dev and test only (SE-07.4). */
export default function SignInPage() {
  if (!serverFlags().isOn('sample-patient-note')) notFound();
  return (
    <main className="page">
      <TestSignIn />
    </main>
  );
}
