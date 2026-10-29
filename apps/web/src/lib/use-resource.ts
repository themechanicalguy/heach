'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

export type Resource<T> =
  { state: 'loading' } | { state: 'error'; error: unknown } | { state: 'ready'; data: T };

/**
 * One API resource of the signed-in account, loaded on mount and again on `reload`. Nothing is
 * stored on the device (EN-11): the data lives only in this component's memory.
 */
export function useResource<T>(path: string): {
  resource: Resource<T>;
  reload: () => Promise<void>;
} {
  const [resource, setResource] = useState<Resource<T>>({ state: 'loading' });
  const reload = useCallback(async () => {
    try {
      setResource({ state: 'ready', data: await api<T>(path) });
    } catch (error) {
      setResource({ state: 'error', error });
    }
  }, [path]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { resource, reload };
}
