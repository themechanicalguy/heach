'use client';

import { isStaffRole } from '../setup/roles';
import { OnboardingView } from '../onboarding/OnboardingView';
import { RequireAccount } from './RequireAccount';
import { StaffHome } from './StaffHome';

/** A provider's application, or a staff member's lab or clinic (O-1). */
export function ProviderPage() {
  return (
    <RequireAccount page="provider">
      {(me) => (
        <>
          {isStaffRole(me.activeRole) && <StaffHome me={me} />}
          {me.activeRole !== 'clinic_front_desk' && <OnboardingView />}
        </>
      )}
    </RequireAccount>
  );
}
