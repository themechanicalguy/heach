'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import { useAccount } from './account';
import { isCareRole } from './routing';
import { useSession } from './session';
import type { Service } from '../components/care/services';

/** Search terms stay in memory; only the PIN can be remembered in authorized server preferences. */
export interface CareSearch {
  pin: string;
  service: Service;
  q: string;
}
interface Context {
  search: CareSearch;
  setSearch: (value: CareSearch) => void;
  person: string;
  setPerson: (value: string) => void;
}
const CareContext = createContext<Context | undefined>(undefined);

export function CareSearchProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [intent, setIntent] = useState<{
    person: string;
    authenticated: boolean;
    search: CareSearch;
  }>({
    person: '',
    authenticated: false,
    search: { pin: '', service: 'physiotherapy', q: '' },
  });
  const [person, setPerson] = useState('');
  const { status } = useSession();
  const { enabled, account } = useAccount();
  const care =
    enabled &&
    status === 'signed-in' &&
    account.state === 'ready' &&
    isCareRole(account.me.activeRole);
  const search = useMemo(
    () =>
      intent.person === person && (status === 'signed-in' || !intent.authenticated)
        ? intent.search
        : { ...intent.search, pin: '', q: '' },
    [intent, person, status],
  );
  const setSearch = useCallback(
    (value: CareSearch) => {
      setIntent({ person, authenticated: status === 'signed-in', search: value });
    },
    [person, status],
  );
  useEffect(() => {
    if (!care) return;
    let active = true;
    void api<{ pin: string | null }>('/me/care-pin/read', {
      method: 'POST',
      body: JSON.stringify({ person: person || undefined }),
    })
      .then((saved) => {
        if (active)
          setIntent((current) =>
            current.person === person && current.search.pin
              ? current
              : {
                  person,
                  authenticated: true,
                  search: { ...current.search, pin: saved.pin ?? '', q: '' },
                },
          );
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [care, person]);
  useEffect(() => {
    if (status === 'signed-out') {
      setPerson('');
      setIntent({
        person: '',
        authenticated: false,
        search: { pin: '', service: 'physiotherapy', q: '' },
      });
    }
  }, [status]);
  const value = useMemo(
    () => ({ search, setSearch, person, setPerson }),
    [search, person, setSearch],
  );
  return <CareContext value={value}>{children}</CareContext>;
}

export function useCareSearch(): Context {
  const context = useContext(CareContext);
  if (!context) throw new Error('useCareSearch outside CareSearchProvider');
  return context;
}
