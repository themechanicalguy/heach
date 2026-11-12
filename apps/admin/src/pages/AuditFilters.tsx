import { Button, TextField } from '@heach/ui';
import { useState } from 'react';
import { t } from '../i18n';
import { type AuditFilterValues, NO_FILTERS } from './audit-query';

const TEXT_FIELDS = ['actorId', 'actorRole', 'action', 'entity', 'entityId'] as const;
const DATE_FIELDS = ['from', 'to'] as const;

interface Props {
  onSearch: (filters: AuditFilterValues) => void;
}

/** The audit log filters (AD-11); nothing is sent until Search. */
export function AuditFilters({ onSearch }: Readonly<Props>) {
  const [draft, setDraft] = useState(NO_FILTERS);
  const change = (key: keyof AuditFilterValues) => (event: { target: { value: string } }) => {
    setDraft({ ...draft, [key]: event.target.value });
  };
  return (
    <form
      className="admin-filters"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft);
      }}
    >
      {TEXT_FIELDS.map((key) => (
        <TextField key={key} label={t(`audit.${key}`)} value={draft[key]} onChange={change(key)} />
      ))}
      {DATE_FIELDS.map((key) => (
        <TextField
          key={key}
          type="date"
          label={t(`audit.${key}`)}
          value={draft[key]}
          onChange={change(key)}
        />
      ))}
      <Button type="submit">{t('audit.search')}</Button>
      <Button
        type="button"
        className="heach-button--secondary"
        onClick={() => {
          setDraft(NO_FILTERS);
          onSearch(NO_FILTERS);
        }}
      >
        {t('audit.clear')}
      </Button>
    </form>
  );
}
