'use client';

import type { SetupStep } from '../../lib/routing';
import { RequireAccount } from '../account/RequireAccount';
import { ConsentStep } from './ConsentStep';
import { DetailsStep } from './DetailsStep';
import { RoleStep } from './RoleStep';
import { SetupFrame } from './SetupFrame';

/** Account setup, resumable at any step the saved draft allows (PO-03). */
export function SetupPage({ step }: Readonly<{ step: SetupStep }>) {
  return (
    <RequireAccount page="setup">
      {(me) => (
        <SetupFrame step={step}>
          {step === 'role' && <RoleStep saved={me.setup.draft.role} />}
          {step === 'details' && <DetailsStep draft={me.setup.draft} />}
          {step === 'consent' && <ConsentStep due={me.consentsDue} />}
        </SetupFrame>
      )}
    </RequireAccount>
  );
}
