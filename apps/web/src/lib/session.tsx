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
import {
  api,
  onSessionEnded,
  refreshSession,
  signOutEverywhere,
  signOutOfThisDevice,
  startSession,
} from './api';
import type { AccessToken } from '@heach/types';
import { clearOfflineSummary } from './offline-summary';

type Status = 'checking' | 'signed-in' | 'signed-out';

interface Session {
  status: Status;
  /** After OTP sign-in, setup or a role switch: the access token for the session (memory only). */
  adoptToken: (accessToken: string) => void;
  signInAsTestUser: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
}

const SessionContext = createContext<Session | undefined>(undefined);

/** Restores the session from the refresh cookie on load; tokens never touch storage. */
export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [status, setStatus] = useState<Status>('checking');
  // A session that ends anywhere (rejected refresh, sign-out in another tab) shows here (SE-07.8).
  useEffect(
    () =>
      onSessionEnded(() => {
        // The offline booking summary never outlives the session (BK-07).
        clearOfflineSummary();
        setStatus('signed-out');
      }),
    [],
  );
  // StrictMode's double start shares one refresh (SE-07.6); a network failure keeps the cookie.
  useEffect(() => {
    let mounted = true;
    void refreshSession().then((outcome) => {
      if (mounted) setStatus(outcome === 'ok' ? 'signed-in' : 'signed-out');
    });
    return () => {
      mounted = false;
    };
  }, []);
  const signInAsTestUser = useCallback(async (userId: string) => {
    const { accessToken } = await api<AccessToken>('/auth/test-login', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    startSession(accessToken);
    setStatus('signed-in');
  }, []);
  const adoptToken = useCallback((accessToken: string) => {
    startSession(accessToken);
    setStatus('signed-in');
  }, []);
  const signOut = useCallback(async () => {
    await signOutOfThisDevice();
    setStatus('signed-out');
  }, []);
  const signOutAll = useCallback(async () => {
    await signOutEverywhere();
    setStatus('signed-out');
  }, []);
  const value = useMemo(
    () => ({ status, adoptToken, signInAsTestUser, signOut, signOutAll }),
    [status, adoptToken, signInAsTestUser, signOut, signOutAll],
  );
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}
