'use client';

import { Button, EmptyState, ErrorState, Notice, Skeleton, TextField } from '@heach/ui';
import type { CatalogueItem, SearchResult } from '@heach/types';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { errorMessageKey } from '../../lib/errors';
import { useI18n } from '../../lib/i18n-context';
import { useCareSearch } from '../../lib/care-search';
import { ProviderCard } from './ProviderCard';
import { PIN_PATTERN, type Service } from './services';

type Results =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: unknown }
  | { state: 'ready'; items: SearchResult[] };

/**
 * Search intent stays in memory; POST bodies keep PIN and care terms out of URLs (SD-02/03).
 */
export function SearchView({ service }: Readonly<{ service: Service }>) {
  const { locale, t } = useI18n();
  const { search, setSearch } = useCareSearch();
  const [filters, setFilters] = useState<Filters>({
    pin: search.pin,
    q: search.q,
    item: '',
    language: '',
    gender: '',
    maxFeePaise: '',
    minRating: '',
    availableBy: '',
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
      const body = {
        service,
        locale,
        ...Object.fromEntries(
          Object.entries(current)
            .filter(([, value]) => value)
            .map(([key, value]) => [
              key,
              ['maxFeePaise', 'minRating'].includes(key) ? Number(value) : value,
            ]),
        ),
      };
      setResults({ state: 'loading' });
      try {
        setResults({
          state: 'ready',
          items: await api<SearchResult[]>('/search', {
            method: 'POST',
            body: JSON.stringify(body),
          }),
        });
      } catch (error) {
        setResults({ state: 'error', error });
      }
    },
    [service, locale],
  );

  const initial = useRef(filters);
  useEffect(() => {
    // A search begun on the home page continues without putting it in a URL.
    if (PIN_PATTERN.test(initial.current.pin)) void run(initial.current);
  }, [run]);

  const submit = () => {
    if (!PIN_PATTERN.test(filters.pin)) {
      setPinError(true);
      return;
    }
    setPinError(false);
    setSearch({ service, pin: filters.pin, q: filters.q });
    void run(filters);
  };

  return (
    <section className="flow" aria-labelledby="search-title" id="find-care">
      <div className="flow__card">
        <h2 id="search-title" className="flow__title">
          {t('search.title', { service: t(`services.${service}`) })}
        </h2>
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
            href={`/${locale}/book/any/${filters.item}`}
          >
            {t('book.anyTitle')}
          </Link>
        )}
        <ResultList results={results} onRetry={() => void run(filters)} />
      </div>
    </section>
  );
}

type Filters = Record<
  'pin' | 'item' | 'language' | 'gender' | 'q' | 'maxFeePaise' | 'minRating' | 'availableBy',
  string
>;

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
          ['or', t('locale.or')],
          ['en', t('locale.en')],
          ['hi', t('locale.hi')],
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
      <AdvancedFilters filters={filters} onChange={onChange} />
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
  const { t } = useI18n();
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
            <ProviderCard result={result} />
          </li>
        ))}
      </ul>
    </>
  );
}

function AdvancedFilters({ filters, onChange }: Readonly<Pick<FormProps, 'filters' | 'onChange'>>) {
  const { t } = useI18n();
  return (
    <>
      <TextField
        label={t('site.maxFee')}
        type="number"
        min={1}
        value={filters.maxFeePaise ? String(Number(filters.maxFeePaise) / 100) : ''}
        onChange={(event) => {
          onChange(
            'maxFeePaise',
            event.currentTarget.value ? String(Number(event.currentTarget.value) * 100) : '',
          );
        }}
      />
      <Select
        label={t('site.rating')}
        value={filters.minRating}
        onChange={(value) => {
          onChange('minRating', value);
        }}
        options={[
          ['', t('search.anyItem')],
          ...[1, 2, 3, 4, 5].map((value): [string, string] => [String(value), String(value)]),
        ]}
      />
      <TextField
        label={t('site.earliest')}
        type="datetime-local"
        value={filters.availableBy}
        onChange={(event) => {
          onChange('availableBy', event.currentTarget.value);
        }}
      />
    </>
  );
}
