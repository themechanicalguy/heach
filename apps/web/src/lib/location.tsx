'use client';

import { usePathname } from 'next/navigation';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { isService, PIN_PATTERN, type Service } from '../components/care/services';
import { useAccount } from './account';
import { api } from './api';
import { useCareSearch } from './care-search';
import { isCareRole } from './routing';

export type CheckStatus = 'idle' | 'checking' | 'ready' | 'error';

interface Location {
  status: CheckStatus;
  /** The PIN the result belongs to; a newer PIN is checking until this catches up. */
  checkedPin: string;
  /** Services with published listings at the checked PIN. */
  served: readonly Service[];
  dialogOpen: boolean;
  openDialog: () => void;
  closeDialog: () => void;
  recheck: () => void;
}

const LocationContext = createContext<Location | undefined>(undefined);

const ASKED_KEY = 'heach:location-asked';
const SERVICE_PATH = /^\/(?:or|en|hi)\/services\/([a-z]+)/;
const LANDING_PATH = /^\/(?:or|en|hi)(?:\/services\/[a-z]+)?\/?$/;
const CARE_PATH = /^\/(?:or|en|hi)(?:\/?$|\/(?:services|providers|book)(?:\/|$))/;

/** Where the "where do you need care?" question opens by itself: home and the service pages. */
export const isLandingPage = (pathname: string) => LANDING_PATH.test(pathname);

/** Pages where the not-served banner belongs: the ones a patient uses to find and book care. */
export const isCarePage = (pathname: string) => CARE_PATH.test(pathname);

/** A flag, never the PIN: whether this tab has already been asked. */
export function wasAsked(): boolean {
  try {
    return sessionStorage.getItem(ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markAsked(): void {
  try {
    sessionStorage.setItem(ASKED_KEY, '1');
  } catch {
    // Private browsing: the question may simply come back on the next page load.
  }
}

/**
 * Checks the PIN in the search state against published coverage (SD-04) and holds the dialog's
 * open state. The PIN stays in memory and in POST bodies, as everywhere else (SD-02, SD-03).
 */
export function LocationProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { search } = useCareSearch();
  const [result, setResult] = useState<Pick<Location, 'status' | 'checkedPin' | 'served'>>({
    status: 'idle',
    checkedPin: '',
    served: [],
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pin = search.pin;
  useEffect(() => {
    if (!PIN_PATTERN.test(pin)) {
      setResult({ status: 'idle', checkedPin: '', served: [] });
      return;
    }
    let current = true;
    setResult({ status: 'checking', checkedPin: pin, served: [] });
    void api<{ services: string[] }>('/coverage', { method: 'POST', body: JSON.stringify({ pin }) })
      .then(
        (found) => ({ status: 'ready' as const, served: found.services.filter(isService) }),
        () => ({ status: 'error' as const, served: [] }),
      )
      .then((next) => {
        if (current) setResult({ ...next, checkedPin: pin });
      });
    return () => {
      current = false;
    };
  }, [pin, attempt]);
  const openDialog = useCallback(() => {
    setDialogOpen(true);
  }, []);
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);
  const recheck = useCallback(() => {
    setAttempt((count) => count + 1);
  }, []);
  const value = useMemo(
    () => ({ ...result, dialogOpen, openDialog, closeDialog, recheck }),
    [result, dialogOpen, openDialog, closeDialog, recheck],
  );
  return <LocationContext value={value}>{children}</LocationContext>;
}

export function useLocation(): Location {
  const context = useContext(LocationContext);
  if (!context) throw new Error('useLocation outside LocationProvider');
  return context;
}

/** The service a page is about: the one in its address, else the one last chosen. */
export function useActiveService(): Service {
  const pathname = usePathname();
  const { search } = useCareSearch();
  const fromPath = SERVICE_PATH.exec(pathname)?.[1];
  return fromPath && isService(fromPath) ? fromPath : search.service;
}

/** Providers and other signed-in roles never see the patient's location question or banner. */
export function useIsCareAudience(): boolean {
  const { account } = useAccount();
  return account.state !== 'ready' || isCareRole(account.me.activeRole);
}
