'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, refreshSession, setAccessToken } from './api';
import type { AccessToken } from '@heach/types';

type Status = 'checking' | 'signed-in' | 'signed-out';

interface Session {
  status: Status;
  signInAsTestUser: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | undefined>(undefined);

/** Restores the session from the refresh cookie on load; tokens never touch storage. */
export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [status, setStatus] = useState<Status>('checking');
  useEffect(() => {
    void refreshSession().then((ok) => {
      setStatus(ok ? 'signed-in' : 'signed-out');
    });
  }, []);
  const signInAsTestUser = useCallback(async (userId: string) => {
    const { accessToken } = await api<AccessToken>('/auth/test-login', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    setAccessToken(accessToken);
    setStatus('signed-in');
  }, []);
  const signOut = useCallback(async () => {
    await api<undefined>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ allDevices: false }),
    });
    setAccessToken(undefined);
    setStatus('signed-out');
  }, []);
  const value = useMemo(
    () => ({ status, signInAsTestUser, signOut }),
    [status, signInAsTestUser, signOut],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}
