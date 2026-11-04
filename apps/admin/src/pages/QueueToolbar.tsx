import { Icon } from '@heach/ui';
import { useState } from 'react';
import { t } from '../i18n';
import { roleName } from './status-badges';

export interface QueueFilters {
  view: 'open' | 'decided';
  role: string;
  q: string;
}

const ROLES = ['physiotherapist', 'nurse', 'attendant', 'lab', 'sample_collector'] as const;

/**
 * The compact queue toolbar (G17, admin A): name search, provider type and waiting or decided.
 * Every filter is applied by the server; the name travels in a request body, never a URL.
 */
export function QueueToolbar({
  filters,
  onChange,
}: Readonly<{ filters: QueueFilters; onChange: (filters: QueueFilters) => void }>) {
  const [draft, setDraft] = useState(filters.q);
  return (
    <form
      className="admin-toolbar"
      role="search"
      aria-label={t('verification.search')}
      onSubmit={(event) => {
        event.preventDefault();
        onChange({ ...filters, q: draft.trim() });
      }}
    >
      <label className="admin-toolbar__search">
        <span className="heach-visually-hidden">{t('verification.search')}</span>
        <Icon name="search" size={18} />
        <input
          type="search"
          maxLength={60}
          placeholder={t('verification.search')}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
        />
      </label>
      <label className="admin-toolbar__select">
        <span className="heach-visually-hidden">{t('verification.role')}</span>
        <select
          value={filters.role}
          onChange={(event) => {
            onChange({ ...filters, role: event.target.value });
          }}
        >
          <option value="">{t('verification.allRoles')}</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {roleName(role)}
            </option>
          ))}
        </select>
      </label>
      <label className="admin-toolbar__select">
        <span className="heach-visually-hidden">{t('verification.status')}</span>
        <select
          value={filters.view}
          onChange={(event) => {
            onChange({ ...filters, view: event.target.value === 'decided' ? 'decided' : 'open' });
          }}
        >
          <option value="open">{t('verification.viewOpen')}</option>
          <option value="decided">{t('verification.viewDecided')}</option>
        </select>
      </label>
    </form>
  );
}
