'use client';

import { PeopleView } from '../people/PeopleView';
import { isStaffRole } from '../setup/roles';
import { ConsentUpdate } from '../setup/ConsentUpdate';
import { IdentityReturn } from '../onboarding/IdentityReturn';
import { OnboardingView } from '../onboarding/OnboardingView';
import { TeamView } from '../team/TeamView';
import { AccountView } from './AccountView';
import { RequireAccount } from './RequireAccount';
import { StaffHome } from './StaffHome';

export function ConsentPage() {
  return <RequireAccount page="consent">{(me) => <ConsentUpdate me={me} />}</RequireAccount>;
}

export function AccountPage() {
  return <RequireAccount page="any">{(me) => <AccountView me={me} />}</RequireAccount>;
}

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

/** The identity partner's return page (KY-01). */
export function IdentityReturnPage() {
  return <RequireAccount page="provider">{() => <IdentityReturn />}</RequireAccount>;
}

export function PeoplePage() {
  return <RequireAccount page="care">{() => <PeopleView />}</RequireAccount>;
}

export function TeamPage() {
  return <RequireAccount page="owner">{() => <TeamView />}</RequireAccount>;
}
