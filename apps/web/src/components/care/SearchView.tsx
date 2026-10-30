'use client';

import { formatDateTime, formatPaise } from '@heach/i18n';
import { Button, Card, EmptyState, ErrorState, Notice, Skeleton, TextField } from '@heach/ui';
import type { CatalogueItem, SearchResult } from '@heach/types';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';
import { PIN_PATTERN, type Service } from './services';

type Results =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: unknown }
  | { state: 'ready'; items: SearchResult[] };

/**
 * Search for one service in the patient's PIN code (SD-02 to SD-04). The query lives in the URL
 * only, so nothing about the search is stored on the device.
 */
export function SearchView({ service }: Readonly<{ service: Service }>) {
  const { locale, t } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const [filters, setFilters] = useState<Filters>({
    pin: params.get('pin') ?? '',
    item: params.get('item') ?? '',
    language: params.get('language') ?? '',
    gender: params.get('gender') ?? '',
    q: params.get('q') ?? '',
  });
  const [items, setItems] = useState<CatalogueItem[]>([]);
  const [results, setResults] = useState<Results>({ state: 'idle' });
  const [pinError, setPinError] = useState(false);

  useEffect(() => {
    api<CatalogueItem[]>(`/catalogue?service=${service}&locale=${locale}`).then(setItems, () => {
      setItems([]);
    });
  }, [service, locale]);

  const run = useCallback(
    async (current: Filters) => {
      const query = new URLSearchParams({ service, locale, pin: current.pin });
      for (const key of ['item', 'language', 'gender', 'q'] as const)
        if (current[key]) query.set(key, current[key]);
      setResults({ state: 'loading' });
      try {
        setResults({
          state: 'ready',
          items: await api<SearchResult[]>(`/search?${query.toString()}`),
        });
      } catch (error) {
        setResults({ state: 'error', error });
      }
    },
    [service, locale],
  );

  const initial = useRef(filters);
  useEffect(() => {
    // A shared or reloaded URL searches by itself, once.
    if (PIN_PATTERN.test(initial.current.pin)) void run(initial.current);
  }, [run]);

  const submit = () => {
    if (!PIN_PATTERN.test(filters.pin)) {
      setPinError(true);
      return;
    }
    setPinError(false);
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    router.replace(`/${locale}/services/${service}?${query.toString()}`);
    void run(filters);
  };

  return (
    <section className="flow" aria-labelledby="search-title">
      <div className="flow__card">
        <h1 id="search-title" className="flow__title">
          {t('search.title', { service: t(`services.${service}`) })}
        </h1>
        <SearchForm
          filters={filters}
          items={items}
          pinError={pinError}
          onChange={(key, value) => {
            setFilters((current) => ({ ...current, [key]: value }));
          }}
          onSubmit={submit}
        />
        {results.state === 'ready' && filters.item && PIN_PATTERN.test(filters.pin) && (
          <Link
            className="heach-button heach-button--secondary"
            href={`/${locale}/book/any/${filters.item}?pin=${filters.pin}`}
          >
            {t('book.anyTitle')}
          </Link>
        )}
        <ResultList results={results} onRetry={() => void run(filters)} />
      </div>
    </section>
  );
}

type Filters = Record<'pin' | 'item' | 'language' | 'gender' | 'q', string>;

interface FormProps {
  filters: Filters;
  items: readonly CatalogueItem[];
  pinError: boolean;
  onChange: (key: keyof Filters, value: string) => void;
  onSubmit: () => void;
}

function SearchForm({ filters, items, pinError, onChange, onSubmit }: Readonly<FormProps>) {
  const { t } = useI18n();
  return (
    <form
      className="flow__form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <TextField
        label={t('search.pin')}
        hint={t('search.pinHint')}
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={6}
        value={filters.pin}
        error={pinError ? t('search.pinInvalid') : undefined}
        onChange={(event) => {
          onChange('pin', event.currentTarget.value.trim());
        }}
      />
      <TextField
        label={t('search.text')}
        maxLength={60}
        value={filters.q}
        onChange={(event) => {
          onChange('q', event.currentTarget.value);
        }}
      />
      <Select
        label={t('search.item')}
        value={filters.item}
        onChange={(value) => {
          onChange('item', value);
        }}
        options={[
          ['', t('search.anyItem')],
          ...items.map((item): [string, string] => [item.code, item.name]),
        ]}
      />
      <Select
        label={t('search.language')}
        value={filters.language}
        onChange={(value) => {
          onChange('language', value);
        }}
        options={[
          ['', t('search.anyLanguage')],
          ['or', 'ଓଡ଼ିଆ'],
          ['en', 'English'],
          ['hi', 'हिन्दी'],
        ]}
      />
      <Select
        label={t('search.gender')}
        value={filters.gender}
        onChange={(value) => {
          onChange('gender', value);
        }}
        options={[
          ['', t('search.anyGender')],
          ['female', t('search.genderFemale')],
          ['male', t('search.genderMale')],
        ]}
      />
      <Button type="submit">{t('search.find')}</Button>
    </form>
  );
}

interface SelectProps {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
}

/** A labelled native select: works with every keyboard and screen reader. */
export function Select({ label, value, options, onChange }: Readonly<SelectProps>) {
  return (
    <label className="heach-field">
      <span className="heach-field__label">{label}</span>
      <select
        className="heach-input"
        value={value}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function ResultList({ results, onRetry }: Readonly<{ results: Results; onRetry: () => void }>) {
  const { locale, t } = useI18n();
  if (results.state === 'idle') return null;
  if (results.state === 'loading') return <Skeleton label={t('state.loading')} />;
  if (results.state === 'error') {
    return (
      <ErrorState
        message={t(errorMessageKey(results.error))}
        retryLabel={t('state.retry')}
        onRetry={onRetry}
      />
    );
  }
  if (results.items.length === 0) return <EmptyState message={t('search.empty')} />;
  return (
    <>
      <Notice tone="info" live>
        {t('search.results', { count: results.items.length })}
      </Notice>
      <ul className="role-list">
        {results.items.map((result) => (
          <li key={result.listingId}>
            <Card title={result.name}>
              <p>{result.itemName}</p>
              <p className="flow__muted">
                {t('search.fee', { fee: formatPaise(result.feePaise) })}
                {result.travelSurchargePaise > 0 &&
                  ` ${t('search.surcharge', { fee: formatPaise(result.travelSurchargePaise) })}`}
              </p>
              <p className="flow__muted">
                {result.earliestSlot
                  ? t('search.earliest', {
                      time: formatDateTime(new Date(result.earliestSlot), locale),
                    })
                  : t('search.noSlot')}
              </p>
              <Link
                className="heach-button"
                href={`/${locale}/providers/${result.providerId}?listing=${result.listingId}`}
              >
                {t('search.view')}
              </Link>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
