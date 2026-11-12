import type { components } from '@heach/types';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export type AuditPage = components['schemas']['AuditPageDto'];
export type AuditEntry = components['schemas']['AuditEntryDto'];

/** What the filter form holds; dates are plain `YYYY-MM-DD` values. */
export interface AuditFilterValues {
  actorId: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string;
  from: string;
  to: string;
}

export const NO_FILTERS: AuditFilterValues = {
  actorId: '',
  actorRole: '',
  action: '',
  entity: '',
  entityId: '',
  from: '',
  to: '',
};

const TEXT_KEYS = ['actorId', 'actorRole', 'action', 'entity', 'entityId'] as const;

/** The query string for the filters: dates become the start and the end of that local day. */
export function auditQuery(filters: AuditFilterValues, before?: string): string {
  const params = new URLSearchParams();
  for (const key of TEXT_KEYS) {
    const value = filters[key].trim();
    if (value) params.set(key, value);
  }
  if (filters.from) params.set('from', new Date(`${filters.from}T00:00:00`).toISOString());
  if (filters.to) params.set('to', new Date(`${filters.to}T23:59:59.999`).toISOString());
  if (before) params.set('before', before);
  return params.toString();
}

type Entries =
  | { state: 'loading' }
  | { state: 'error'; error: unknown }
  | { state: 'ready'; entries: AuditEntry[]; nextBefore: string | null };

/** The first page for the filters, and further pages appended on request. */
export function useAuditEntries(filters: AuditFilterValues) {
  const [result, setResult] = useState<{ filters: AuditFilterValues; value: Entries }>();
  useEffect(() => {
    let live = true;
    api<AuditPage>(`/audit?${auditQuery(filters)}`).then(
      (page) => {
        if (live)
          setResult({
            filters,
            value: { state: 'ready', entries: page.entries, nextBefore: page.nextBefore },
          });
      },
      (error: unknown) => {
        if (live) setResult({ filters, value: { state: 'error', error } });
      },
    );
    return () => {
      live = false;
    };
  }, [filters]);
  const loadMore = useCallback(async () => {
    if (result?.filters !== filters || result.value.state !== 'ready') return;
    const { entries, nextBefore } = result.value;
    if (!nextBefore) return;
    const page = await api<AuditPage>(`/audit?${auditQuery(filters, nextBefore)}`);
    setResult({
      filters,
      value: {
        state: 'ready',
        entries: [...entries, ...page.entries],
        nextBefore: page.nextBefore,
      },
    });
  }, [filters, result]);
  return {
    entries: result?.filters === filters ? result.value : ({ state: 'loading' } as Entries),
    loadMore,
  };
}
