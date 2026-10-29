import { useCallback, useEffect, useState } from 'react';

export type Loaded<T> =
  { state: 'loading' } | { state: 'error'; error: unknown } | { state: 'ready'; value: T };

interface Result<T> {
  fetcher: () => Promise<T>;
  version: number;
  loaded: Loaded<T>;
}

/**
 * Loads data for the current `fetcher` (memoised by the caller) and reloads on demand. State is
 * set only when the request settles, and a stale answer never overwrites a newer one.
 */
export function useLoad<T>(fetcher: () => Promise<T>): { loaded: Loaded<T>; reload: () => void } {
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<Result<T> | undefined>();
  useEffect(() => {
    let live = true;
    const settle = (loaded: Loaded<T>) => {
      if (live) setResult({ fetcher, version, loaded });
    };
    fetcher().then(
      (value) => {
        settle({ state: 'ready', value });
      },
      (error: unknown) => {
        settle({ state: 'error', error });
      },
    );
    return () => {
      live = false;
    };
  }, [fetcher, version]);
  const reload = useCallback(() => {
    setVersion((current) => current + 1);
  }, []);
  const current = result?.fetcher === fetcher && result.version === version;
  return { loaded: current ? result.loaded : { state: 'loading' }, reload };
}
