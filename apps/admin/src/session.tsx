import type { AdminMe } from '@heach/types';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, refresh, setAccessToken } from './api';

type State =
  { status: 'checking' } | { status: 'signed-out' } | { status: 'signed-in'; me: AdminMe };

interface Session {
  state: State;
  signedIn: (accessToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | undefined>(undefined);

/** Restores the admin session from its refresh cookie on load; the token stays in memory. */
export function SessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [state, setState] = useState<State>({ status: 'checking' });
  const load = useCallback(async () => {
    setState({ status: 'signed-in', me: await api<AdminMe>('/me') });
  }, []);
  useEffect(() => {
    void refresh()
      .then(async (ok) => {
        if (ok) await load();
        else setState({ status: 'signed-out' });
      })
      .catch(() => {
        setState({ status: 'signed-out' });
      });
  }, [load]);
  const signedIn = useCallback(
    async (accessToken: string) => {
      setAccessToken(accessToken);
      await load();
    },
    [load],
  );
  const signOut = useCallback(async () => {
    await api('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ allDevices: false }),
    }).catch(() => undefined);
    setAccessToken(undefined);
    setState({ status: 'signed-out' });
  }, []);
  const value = useMemo(() => ({ state, signedIn, signOut }), [state, signedIn, signOut]);
  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession outside SessionProvider');
  return value;
}
