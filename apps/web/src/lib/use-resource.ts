'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

export type Resource<T> =
  | { state: 'loading' }
  | { state: 'error'; error: unknown }
  | { state: 'ready'; data: T; refreshError?: unknown };
interface Result<T> {
  path: string;
  body: string | undefined;
  resource: Resource<T>;
}

/**
 * Memory only (EN-11). Changing person/filter hides the previous result immediately; a late
 * response can never replace a newer selection. Disabled reads send nothing to the server.
 */
export function useResource<T>(
  path: string,
  body?: string,
  enabled = true,
): {
  resource: Resource<T>;
  reload: () => Promise<void>;
} {
  const generation = useRef(0);
  const [result, setResult] = useState<Result<T>>({ path, body, resource: { state: 'loading' } });
  const reload = useCallback(async () => {
    const current = ++generation.current;
    if (!enabled) return;
    setResult((previous) =>
      previous.path === path && previous.body === body && previous.resource.state === 'ready'
        ? previous
        : { path, body, resource: { state: 'loading' } },
    );
    try {
      const data =
        body === undefined ? await api<T>(path) : await api<T>(path, { method: 'POST', body });
      if (current === generation.current)
        setResult({ path, body, resource: { state: 'ready', data } });
    } catch (error) {
      if (current === generation.current)
        setResult((previous) =>
          previous.path === path && previous.body === body && previous.resource.state === 'ready'
            ? { ...previous, resource: { ...previous.resource, refreshError: error } }
            : { path, body, resource: { state: 'error', error } },
        );
    }
  }, [path, body, enabled]);
  useEffect(() => {
    void reload();
    return () => {
      generation.current += 1;
    };
  }, [reload]);
  const resource =
    enabled && result.path === path && result.body === body
      ? result.resource
      : { state: 'loading' as const };
  return { resource, reload };
}
