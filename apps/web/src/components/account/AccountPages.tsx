'use client';

import { ConsentUpdate } from '../setup/ConsentUpdate';
import { AccountView } from './AccountView';
import { ApplicationStatus } from './ApplicationStatus';
import { RequireAccount } from './RequireAccount';

export function ConsentPage() {
  return <RequireAccount page="consent">{(me) => <ConsentUpdate me={me} />}</RequireAccount>;
}

export function AccountPage() {
  return <RequireAccount page="any">{(me) => <AccountView me={me} />}</RequireAccount>;
}

export function ProviderPage() {
  return <RequireAccount page="provider">{(me) => <ApplicationStatus me={me} />}</RequireAccount>;
}
