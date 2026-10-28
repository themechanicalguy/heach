'use client';

import type { AccessToken, Me } from '@heach/types';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, startSession } from './api';
import { useSession } from './session';

export type AccountState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: unknown }
  | { state: 'ready'; me: Me };

interface Account {
  /** False where OTP accounts are switched off (flag `accounts`): the shell still works. */
  enabled: boolean;
  account: AccountState;
  reload: () => Promise<Me>;
  switchRole: (role: string) => Promise<Me>;
}

const AccountContext = createContext<Account | undefined>(undefined);

async function fetchMe(): Promise<Me> {
  const me = await api<Me>('/me');
  const first = me.roles[0];
  // Setup finished in another tab: this session still acts as `new_account` until it switches.
  if (me.activeRole === 'new_account' && me.setup.complete && first) {
    const { accessToken } = await api<AccessToken>('/auth/switch-role', {
      method: 'POST',
      body: JSON.stringify({ role: first.role }),
    });
    startSession(accessToken);
    return api<Me>('/me');
  }
  return me;
}

/** The signed-in account (`/v1/me`), loaded when a session starts and cleared when it ends. */
export function AccountProvider({
  enabled,
  children,
}: Readonly<{ enabled: boolean; children: ReactNode }>) {
  const { status } = useSession();
  const [account, setAccount] = useState<AccountState>({ state: 'idle' });

  const reload = useCallback(async () => {
    setAccount((current) => (current.state === 'ready' ? current : { state: 'loading' }));
    try {
      const me = await fetchMe();
      setAccount({ state: 'ready', me });
      return me;
    } catch (error) {
      setAccount({ state: 'error', error });
      throw error;
    }
  }, []);

  useEffect(() => {
    if (!enabled || status !== 'signed-in') {
      setAccount({ state: 'idle' });
      return;
    }
    reload().catch(() => undefined);
  }, [enabled, status, reload]);

  const switchRole = useCallback(
    async (role: string) => {
      const { accessToken } = await api<AccessToken>('/auth/switch-role', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      startSession(accessToken);
      return reload();
    },
    [reload],
  );

  const value = useMemo(
    () => ({ enabled, account, reload, switchRole }),
    [enabled, account, reload, switchRole],
  );
  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): Account {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount outside AccountProvider');
  return value;
}
