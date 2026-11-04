'use client';

import { normalizeDigits } from '@heach/i18n';
import { Button, Notice, TextField } from '@heach/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { usePending } from '../../lib/use-pending';
import { useCareSearch } from '../../lib/care-search';
import { useI18n } from '../../lib/i18n-context';
import { Select } from '../care/SearchView';
import { isService, PIN_PATTERN, SERVICES } from '../care/services';

interface FinderProps {
  textSearch?: boolean;
  stayOnHome?: boolean;
  /** The home screen's one-row search (G02): small labels, no surrounding hero. */
  compact?: boolean;
}

export function CareFinder(props: Readonly<FinderProps>) {
  const { person } = useCareSearch();
  return <CareFinderForm key={person} {...props} />;
}

/** Shared hero, area check and final search; search intent travels in memory, never the URL. */
function CareFinderForm({
  textSearch = false,
  stayOnHome = false,
  compact = false,
}: Readonly<FinderProps>) {
  const { locale, t } = useI18n();
  const { search, setSearch, person } = useCareSearch();
  const [draft, setDraft] = useState(search);
  const dirty = useRef(false);
  const update = (patch: Partial<typeof search>) => {
    dirty.current = true;
    setDraft((current) => ({ ...current, ...patch }));
  };
  const [invalid, setInvalid] = useState(false);
  const router = useRouter();
  const { error, run } = usePending();
  useEffect(() => {
    if (!dirty.current) setDraft(search);
  }, [search]);
  const submit = () => {
    if (!PIN_PATTERN.test(draft.pin)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    dirty.current = false;
    setSearch(draft);
    if (stayOnHome)
      void run(async () => {
        await api('/me/care-pin', {
          method: 'PUT',
          body: JSON.stringify({ person: person || undefined, pin: draft.pin }),
        });
      });
    if (!stayOnHome) router.push(`/${locale}/services/${draft.service}#find-care`);
  };
  return (
    <form
      className={compact ? 'care-finder care-finder--compact' : 'care-finder'}
      role={compact ? 'search' : undefined}
      aria-label={compact ? t('site.search') : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {textSearch && (
        <div className="care-finder__text">
          <TextField
            label={t('search.text')}
            value={draft.q}
            maxLength={60}
            onChange={(event) => {
              update({ q: event.currentTarget.value });
            }}
          />
        </div>
      )}
      <TextField
        label={t('search.pin')}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        value={draft.pin}
        error={invalid ? t('search.pinInvalid') : undefined}
        onChange={(event) => {
          update({ pin: normalizeDigits(event.currentTarget.value.trim()) });
        }}
      />
      <Select
        label={t('site.services')}
        value={draft.service}
        options={SERVICES.map((service) => [service, t(`services.${service}`)])}
        onChange={(service) => {
          if (isService(service)) update({ service });
        }}
      />
      <Button type="submit">{t('site.find')}</Button>
      {error && (
        <Notice tone="danger" live>
          {t(error)}
        </Notice>
      )}
    </form>
  );
}
