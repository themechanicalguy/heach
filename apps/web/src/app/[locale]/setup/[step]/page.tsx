import { notFound } from 'next/navigation';
import { SetupPage } from '../../../../components/setup/SetupPage';
import { serverFlags } from '../../../../lib/flags';
import { SETUP_STEPS, type SetupStep } from '../../../../lib/routing';

export default async function SetupStepPage({
  params,
}: Readonly<{ params: Promise<{ step: string }> }>) {
  const { step } = await params;
  if (!serverFlags().isOn('accounts') || !(SETUP_STEPS as readonly string[]).includes(step))
    notFound();
  return (
    <main className="page">
      <SetupPage step={step as SetupStep} />
    </main>
  );
}
