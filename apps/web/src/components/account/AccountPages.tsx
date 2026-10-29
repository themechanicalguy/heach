'use client';

import { PeopleView } from '../people/PeopleView';
import { isStaffRole } from '../setup/roles';
import { ConsentUpdate } from '../setup/ConsentUpdate';
import { IdentityReturn } from '../onboarding/IdentityReturn';
import { OnboardingView } from '../onboarding/OnboardingView';
import { ProviderServicesView } from '../provider-services/ProviderServicesView';
import { BookAny, BookChosen } from '../booking/BookPages';
import { BookingDetailView, BookingsView } from '../booking/BookingsView';
import { EarningsView } from '../work/EarningsView';
import { NotificationsView } from '../work/NotificationsView';
import { RequestsView } from '../work/RequestsView';
import { WorkView } from '../work/WorkView';
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

/** An Approved provider's services, area and hours (Step 4). */
export function ProviderServicesPage() {
  return <RequireAccount page="provider">{() => <ProviderServicesView />}</RequireAccount>;
}

export function PeoplePage() {
  return <RequireAccount page="care">{() => <PeopleView />}</RequireAccount>;
}

export function TeamPage() {
  return <RequireAccount page="owner">{() => <TeamView />}</RequireAccount>;
}

export function BookChosenPage({ listingId }: Readonly<{ listingId: string }>) {
  return <RequireAccount page="care">{() => <BookChosen listingId={listingId} />}</RequireAccount>;
}

export function BookAnyPage({ itemCode }: Readonly<{ itemCode: string }>) {
  return <RequireAccount page="care">{() => <BookAny itemCode={itemCode} />}</RequireAccount>;
}

export function BookingsPage() {
  return <RequireAccount page="care">{() => <BookingsView />}</RequireAccount>;
}

export function BookingPage({ bookingId }: Readonly<{ bookingId: string }>) {
  return (
    <RequireAccount page="care">{() => <BookingDetailView bookingId={bookingId} />}</RequireAccount>
  );
}

export function RequestsPage() {
  return <RequireAccount page="provider">{() => <RequestsView />}</RequireAccount>;
}

export function WorkPage() {
  return <RequireAccount page="provider">{() => <WorkView />}</RequireAccount>;
}

export function EarningsPage() {
  return <RequireAccount page="provider">{() => <EarningsView />}</RequireAccount>;
}

export function NotificationsPage() {
  return <RequireAccount page="any">{() => <NotificationsView />}</RequireAccount>;
}
